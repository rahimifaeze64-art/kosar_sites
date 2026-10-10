"""Persian text-to-speech with voice cloning, on CPU.

A thin, opinionated wrapper around `pocket-tts` (the Farsi fork) and the
Homo-GE2PE Persian G2P frontend. The three stages are the same ones the model
card prescribes, and the chunking mirrors `training/farsi/v2/space/app.py` from
the fork, which is the recipe the released model was validated with:

1. normalise the Persian (spells numbers out, unifies Arabic/Persian letters),
2. phonemise with Homo-GE2PE — v2 reads romanised phonemes, not Persian script,
3. synthesise chunk by chunk and join with pauses.

Feeding Persian script straight to v2 does not raise: it produces silence. That
is why the steps are kept separate and visible in `SynthResult.phonemes`.
"""

from __future__ import annotations

import logging
import math
import re
import threading
import time
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Callable, Iterable, Sequence

from . import paths  # must come first: sets HF_HOME / sys.path

import numpy as np
import torch

from . import audio_io

logger = logging.getLogger("farsi_tts")

SAMPLE_RATE = paths.SAMPLE_RATE

# GE2PE's internal alphabet -> the notation this model was trained on.
TO_PHONEMES = str.maketrans({"/": "a", "a": "A", "@": "?", "$": "S", "c": "C"})
# GE2PE marks the ezafe with a trailing "1" ("?eqtesAde1 ?AmrikA" = eqtesad-e
# amrika). The model never sees it — the training corpus had it stripped — but
# the chunker needs it, or a boundary lands inside a noun phrase.
EZAFE_MARK = "1"

SENTENCE_SPLIT = re.compile(r"(?<=[.!؟])\s+")
CLAUSE_SPLIT = re.compile(r"(?<=[،؛:])\s+")


@dataclass
class Settings:
    """Generation parameters. Defaults are the ones the model was validated with."""

    temperature: float = 0.3
    eos_threshold: float = -2.0
    # Training utterances averaged ~11 tokens; 18 is a safe chunk budget, 21+ is
    # where generations stop emitting end-of-speech.
    max_tokens: int = 18
    # Below ~7 tokens the model tends to continue the voice prompt instead of
    # the requested text, so chunks are kept above this.
    min_tokens: int = 5
    # Training capped voice prompts at 5 s; longer ones are out of distribution
    # and the model speaks the prompt's own words instead of yours.
    voice_sec: float = 5.0
    join_sec: float = 0.15      # silence where a chunk was split for budget
    pause_sec: float = 0.30     # silence at a sentence end
    frames_after_eos: int = 0
    retries: int = 2            # re-rolls when a generation runs away
    max_chars: int = 4000

    @property
    def clause_sec(self) -> float:
        return 0.5 * (self.pause_sec + self.join_sec)


@dataclass
class SynthResult:
    """Generated audio plus enough provenance to debug a bad take."""

    audio: np.ndarray
    sample_rate: int
    phonemes: str
    chunks: list[str]
    sentences: int
    voice: str
    elapsed: float
    warnings: list[str] = field(default_factory=list)
    timings: dict[str, float] = field(default_factory=dict)

    @property
    def seconds(self) -> float:
        return float(self.audio.shape[-1]) / self.sample_rate


class FarsiTTS:
    """Load once, synthesise many times. Not thread-safe: calls are serialised."""

    def __init__(
        self,
        settings: Settings | None = None,
        *,
        model_id: str = paths.MODEL_ID,
        config: str = paths.MODEL_CONFIG,
        g2p_id: str = paths.G2P_ID,
        device: str = "cpu",
        quantize: bool = False,
    ) -> None:
        self.settings = settings or Settings()
        self.model_id = model_id
        self.config = config
        self.g2p_id = g2p_id
        self.device = device
        self.quantize = quantize

        self._lock = threading.RLock()
        self._model = None
        self._g2p = None
        self._g2p_tok = None
        self._sp = None
        self._normalize = None
        self._voice_cache: dict[tuple[str, float], object] = {}
        self._loaded_at: float | None = None

    # ------------------------------------------------------------------ loading

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    def load(self, progress: Callable[[str], None] | None = None) -> "FarsiTTS":
        """Download (first run) and build the models. Idempotent."""
        with self._lock:
            if self._model is not None:
                return self

            def say(message: str) -> None:
                logger.info(message)
                if progress:
                    progress(message)

            say(f"loading TTS model {self.model_id} (first run downloads ~420 MB)")
            from pocket_tts import TTSModel

            model = TTSModel.load_model(
                config=self.config,
                temp=self.settings.temperature,
                eos_threshold=self.settings.eos_threshold,
                quantize=self.quantize,
            )
            if self.device and self.device != "cpu":
                model = model.to(self.device)
            self._model = model
            self._sp = model.flow_lm.conditioner.tokenizer.sp

            say(f"loading Persian G2P {self.g2p_id}")
            from transformers import AutoTokenizer, T5ForConditionalGeneration

            self._g2p_tok = AutoTokenizer.from_pretrained(self.g2p_id)
            self._g2p = T5ForConditionalGeneration.from_pretrained(self.g2p_id).eval()
            if self.device and self.device != "cpu":
                self._g2p = self._g2p.to(self.device)

            self._normalize = paths.load_normalize_for_model()
            self._loaded_at = time.time()
            say("models ready")
            return self

    @property
    def model(self):
        return self.load()._model

    # ----------------------------------------------------------------- phonemes

    def phonemise(self, text: str) -> str:
        """Persian script -> phonemes. The ezafe mark is kept for the chunker.

        Normalisation runs first and on purpose: the G2P has no reading for
        digits and drops them silently, so "تا سال ۲۰۳۰" would come back as
        "tA sAle" with the year simply gone.
        """
        self.load()
        text = self._normalize(text)
        # "؟" and the glottal stop share a symbol in this notation, so the mark
        # has to go before the G2P rather than after.
        text = text.replace("؟", "").replace("?", "")
        if not text.strip():
            raise ValueError(
                "nothing left after Persian normalisation — the input had no "
                "Persian letters or digits to read"
            )
        enc = self._g2p_tok([text], add_special_tokens=False, return_tensors="pt")
        enc = {k: v.to(self.device) if self.device and self.device != "cpu" else v
               for k, v in enc.items()}
        with torch.no_grad():
            out = self._g2p.generate(**enc, num_beams=5, max_length=512, early_stopping=True)
        raw = self._g2p_tok.batch_decode(out, skip_special_tokens=True)[0].strip()
        return raw.translate(TO_PHONEMES)

    @staticmethod
    def strip_ezafe(phonemes: str) -> str:
        return phonemes.replace(EZAFE_MARK, "")

    def count_tokens(self, text: str) -> int:
        self.load()
        return len(self._sp.encode(self.strip_ezafe(text)))

    # -------------------------------------------------------------------- plan

    def plan(self, text: str, settings: Settings | None = None
             ) -> tuple[list[tuple[str, str]], int]:
        """Persian text -> [(chunk, boundary kind)], sentence count.

        Sentence and clause splitting happens on the Persian, before
        phonemising, because the G2P discards punctuation: once text is
        phonemes there is nothing left to break on and any chunker cuts on
        token count alone, landing mid-phrase.
        """
        settings = settings or self.settings
        text = (text or "").strip()
        if not text:
            raise ValueError("no text to synthesise")
        if len(text) > settings.max_chars:
            text = text[: settings.max_chars]

        sentences = [s.strip() for s in SENTENCE_SPLIT.split(text) if s.strip()]
        if not sentences:
            sentences = [text]

        plan: list[tuple[str, str]] = []
        for sentence in sentences:
            chunks = self._plan_sentence(sentence, settings)
            if not chunks:
                continue
            plan.extend(chunks[:-1])
            plan.append((chunks[-1][0], "sentence"))
        if not plan:
            raise ValueError("nothing to synthesise after chunking")
        return plan, len(sentences)

    def _plan_sentence(self, sentence: str, settings: Settings) -> list[tuple[str, str]]:
        words: list[tuple[str, bool]] = []
        for clause in CLAUSE_SPLIT.split(sentence):
            if not clause.strip():
                continue
            phonemes = self.phonemise(clause).split()
            words.extend((w, i == len(phonemes) - 1) for i, w in enumerate(phonemes))
        if not words:
            return []

        joined = " ".join(w for w, _ in words)
        total = self.count_tokens(joined)
        n_chunks = max(1, math.ceil(total / settings.max_tokens))
        out: list[tuple[str, str]] = []
        for _ in range(4):
            target = math.ceil(total / n_chunks)
            out = []
            current = ""
            for i, (word, ends_clause) in enumerate(words):
                trial = f"{current} {word}".strip()
                bound = bool(current) and current.split()[-1].endswith(EZAFE_MARK)
                if current and not bound and self.count_tokens(trial) > settings.max_tokens:
                    out.append((current, "budget"))
                    current = word
                    continue
                current = trial
                if not ends_clause or i == len(words) - 1:
                    continue
                # A comma is the author saying where the pause goes, so honour
                # it — the only reason to refuse is a chunk so short the model
                # continues the voice prompt instead.
                rest = self.count_tokens(" ".join(w for w, _ in words[i + 1:]))
                if self.count_tokens(current) >= settings.min_tokens and rest >= settings.min_tokens:
                    out.append((current, "clause"))
                    current = ""
            if current:
                out.append((current, "clause"))
            if len(out) <= n_chunks:
                break
            n_chunks = len(out)

        # Pull words back from the neighbour rather than leave a starved tail.
        for i in range(len(out) - 1, 0, -1):
            while self.count_tokens(out[i][0]) < settings.min_tokens:
                previous = out[i - 1][0].split()
                if len(previous) < 2 or self.count_tokens(" ".join(previous[:-1])) < settings.min_tokens:
                    break
                out[i - 1] = (" ".join(previous[:-1]), out[i - 1][1])
                out[i] = (f"{previous[-1]} {out[i][0]}", out[i][1])
        return out

    # ------------------------------------------------------------------ voices

    def list_voices(self) -> list[str]:
        names = set()
        for path in paths.VOICES_DIR.glob("*.wav"):
            names.add(path.stem)
        for path in paths.VOICES_DIR.glob("*.safetensors"):
            names.add(path.stem)
        names.update(paths.BUILTIN_VOICES)
        return sorted(names)

    def resolve_voice(self, voice: str | Path | None) -> str | Path:
        """Turn a voice name into something `get_state_for_audio_prompt` reads."""
        if voice is None or voice == "":
            voice = paths.DEFAULT_VOICE
        if isinstance(voice, Path):
            return voice
        candidate = Path(voice)
        if candidate.is_file():
            return candidate
        if voice.startswith(("hf://", "http://", "https://")):
            return voice
        if voice in paths.BUILTIN_VOICES:
            return paths.BUILTIN_VOICES[voice]
        for suffix in (".safetensors", ".wav", ".mp3", ".flac", ".ogg"):
            local = paths.VOICES_DIR / f"{voice}{suffix}"
            if local.is_file():
                return local
        raise FileNotFoundError(
            f"unknown voice {voice!r}. Known voices: {', '.join(self.list_voices())}"
        )

    def enroll(
        self,
        name: str,
        source: str | Path | np.ndarray,
        sample_rate: int | None = None,
        *,
        seconds: float | None = None,
        trim: bool = False,
    ) -> Path:
        """Store a voice prompt under `name` and return the written WAV.

        2–5 seconds of one clean speaker is the whole requirement. Longer is not
        better: past 5 s the model starts speaking the prompt's own sentence.
        """
        seconds = self.settings.voice_sec if seconds is None else float(seconds)
        if isinstance(source, np.ndarray):
            if sample_rate is None:
                raise ValueError("sample_rate is required when passing raw samples")
            samples = np.asarray(source, dtype=np.float32)
            if samples.ndim > 1:
                samples = samples.mean(axis=1)
            rate = int(sample_rate)
        else:
            samples, rate = audio_io.read_audio(source)

        if samples.size == 0:
            raise ValueError("the voice prompt is empty — record 2 to 5 seconds of speech")
        if trim:
            samples = audio_io.trim_silence(samples, rate)

        # Cap by time, but never below a usable prompt.
        if seconds > 0:
            capped = samples[: int(seconds * rate)]
            if capped.size >= int(1.0 * rate):
                samples = capped

        target = paths.VOICES_DIR / f"{name}.wav"
        audio_io.write_wav(target, audio_io.peak_normalise(samples), rate)
        logger.info("voice %r stored: %s (%.2f s @ %d Hz)",
                    name, target, samples.size / rate, rate)

        # A stale exported state would silently shadow the new prompt.
        stale = paths.VOICES_DIR / f"{name}.safetensors"
        if stale.is_file():
            stale.unlink()
            logger.info("removed stale %s", stale.name)
        self._voice_cache.clear()
        return target

    def export_voice(self, name: str) -> Path:
        """Freeze a voice into a .safetensors state for near-instant loading."""
        from pocket_tts import export_model_state

        source = self.resolve_voice(name)
        state, _ = self._state_for(source)
        target = paths.VOICES_DIR / f"{Path(name).stem}.safetensors"
        export_model_state(state, str(target))
        logger.info("exported voice state: %s", target)
        return target

    def _state_for(self, source: str | Path):
        """Cached voice state for a prompt path or hf:// url."""
        key = (str(source), 0.0)
        if isinstance(source, Path) and source.is_file():
            key = (str(source), source.stat().st_mtime)
        cached = self._voice_cache.get(key)
        if cached is not None:
            return cached, True
        state = self.model.get_state_for_audio_prompt(source)
        self._voice_cache[key] = state
        if len(self._voice_cache) > 8:  # keep memory bounded
            self._voice_cache.pop(next(iter(self._voice_cache)))
        return state, False

    # -------------------------------------------------------------- generation

    def _cap_seconds(self, text: str) -> float:
        """How long pocket-tts will let this text generate before giving up."""
        tokens = len(self._sp.encode(text))
        tps = getattr(self.model, "_TOKENS_PER_SECOND_ESTIMATE", 3.0)
        pad = getattr(self.model, "_GEN_SECONDS_PADDING", 2.0)
        return tokens / tps + pad

    def _generate_one(self, state, spoken: str, settings: Settings,
                      warnings: list[str]) -> np.ndarray:
        """Generate a chunk, re-rolling a runaway rather than shipping it."""
        cap = self._cap_seconds(spoken)
        shortest: np.ndarray | None = None
        for attempt in range(settings.retries + 1):
            audio = self.model.generate_audio(
                state, spoken, frames_after_eos=settings.frames_after_eos
            )
            if torch.is_tensor(audio):
                audio = audio.detach().float().cpu().numpy()
            audio = np.asarray(audio, dtype=np.float32).reshape(-1)
            if audio.size == 0 or audio.size / SAMPLE_RATE <= 0.97 * cap:
                return audio
            logger.warning("runaway generation on attempt %d (%.1fs > %.1fs cap)",
                           attempt + 1, audio.size / SAMPLE_RATE, cap)
            warnings.append(f"runaway generation on {spoken[:40]!r}, re-rolled")
            if shortest is None or audio.size < shortest.size:
                shortest = audio
        return shortest if shortest is not None else np.zeros(0, dtype=np.float32)

    def synthesize(
        self,
        text: str,
        voice: str | Path | None = None,
        *,
        settings: Settings | None = None,
        progress: Callable[[int, int, str], None] | None = None,
    ) -> SynthResult:
        """Speak Persian text in the voice of the audio prompt."""
        active = settings or self.settings
        self.load()
        started = time.time()
        warnings: list[str] = []

        t0 = time.time()
        plan, sentence_count = self.plan(text, active)
        t_plan = time.time() - t0
        chunks = [chunk for chunk, _ in plan]
        phonemes = " ".join(self.strip_ezafe(chunk) for chunk in chunks)

        resolved = self.resolve_voice(voice)
        t0 = time.time()
        state, _cached = self._state_for(resolved)
        t_voice = time.time() - t0

        join = np.zeros(int(active.join_sec * SAMPLE_RATE), dtype=np.float32)
        pause = np.zeros(int(active.pause_sec * SAMPLE_RATE), dtype=np.float32)
        clause = np.zeros(int(active.clause_sec * SAMPLE_RATE), dtype=np.float32)
        gaps = {"sentence": pause, "clause": clause}

        with self._lock:
            self.model.temp = float(active.temperature)
            self.model.eos_threshold = float(active.eos_threshold)
            pieces: list[np.ndarray] = []
            t0 = time.time()
            for index, chunk in enumerate(chunks, start=1):
                spoken = self.strip_ezafe(chunk)
                logger.info("[%d/%d] %d tokens: %s", index, len(chunks),
                            self.count_tokens(chunk), spoken)
                if progress:
                    progress(index, len(chunks), spoken)
                pieces.append(
                    audio_io.trim_silence(self._generate_one(state, spoken, active, warnings))
                )
                if index < len(chunks):
                    gap = gaps.get(plan[index - 1][1], join)
                    if gap.size:
                        pieces.append(gap)
            t_generate = time.time() - t0

        audio = (np.concatenate(pieces) if pieces
                 else np.zeros(1, dtype=np.float32)).astype(np.float32)
        return SynthResult(
            audio=audio,
            sample_rate=SAMPLE_RATE,
            phonemes=phonemes,
            chunks=chunks,
            sentences=sentence_count,
            voice=str(resolved),
            elapsed=time.time() - started,
            warnings=warnings,
            timings={"plan": t_plan, "voice_state": t_voice, "generate": t_generate},
        )

    def synthesize_to_file(
        self,
        text: str,
        out_path: str | Path,
        voice: str | Path | None = None,
        **kwargs,
    ) -> tuple[Path, SynthResult]:
        result = self.synthesize(text, voice, **kwargs)
        return audio_io.write_wav(out_path, result.audio, result.sample_rate), result


_default_engine: FarsiTTS | None = None
_default_lock = threading.Lock()


def get_engine(**kwargs) -> FarsiTTS:
    """Process-wide engine; the model is ~420 MB, so build it only once."""
    global _default_engine
    with _default_lock:
        if _default_engine is None:
            _default_engine = FarsiTTS(**kwargs)
        return _default_engine
