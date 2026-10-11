# -*- coding: utf-8 -*-
"""
ai/scripts/generate.py — تولید گفتار فارسی با صدای کلون‌شده

مسیر کامل:
    متن فارسی
      ↓ normalize_fa.normalize_for_model()   اعداد به حرف، یکسان‌سازی حروف
      ↓ Homo-GE2PE (T5)                       تبدیل به فونِم لاتین
      ↓ pocket-tts-farsi-v2                   تولید صدا با نمونهٔ صدای شما
      ↓
    فایل WAV

⚠️ نکتهٔ حیاتی: مدل v2 «خط فارسی» نمی‌فهمد. اگر متن فارسی خام بدهید،
   بی‌صدا بیرون می‌آید و هیچ خطایی هم نمی‌دهد. پس مرحلهٔ G2P اجباری است.

این اسکریپت برای اجرا روی GitHub Actions نوشته شده تا روی سیستم شما
هیچ‌چیز دانلود نشود. اما لوکال هم کار می‌کند.

نمونه:
    python ai/scripts/generate.py \
        --text "سلام، حالت چطور است؟" \
        --voice ai/voices/my_voice.wav \
        --out ai/out/hello.wav
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")

# ── مسیرها ───────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[2]
AI_DIR = ROOT / "ai"
OUT_DIR = AI_DIR / "out"
CACHE_DIR = Path(os.environ.get("AI_CACHE", ROOT / ".ai-cache"))

# همهٔ دانلودهای هاگینگ‌فیس در یک جا کش می‌شوند تا ورکفلو سریع باشد.
# (v1.33 کتابخانهٔ جدید از HF_HOME استفاده می‌کند؛ نسخه‌های قدیمی‌تر
#  از HF_HUB_CACHE — هر دو ست می‌شوند تا فرقی نکند.)
os.environ.setdefault("HF_HOME", str(CACHE_DIR / "hf"))
os.environ.setdefault("HF_HUB_CACHE", str(CACHE_DIR / "hf" / "hub"))
os.environ.setdefault("TRANSFORMERS_CACHE", str(CACHE_DIR / "hf" / "hub"))

MODEL_REPO = os.environ.get("TTS_MODEL_REPO", "mehdi-hf/pocket-tts-farsi-v2")
G2P_REPO = os.environ.get("TTS_G2P_REPO", "mehdi-hf/Homo-GE2PE-Persian-HF")

# فونِم‌های مدل: A صدای کشیده، a کوتاه، ? ایست چاکنایی، S ش، C چ، ; ژ
TO_PHONEMES = str.maketrans({"/": "a", "a": "A", "@": "?", "$": "S", "c": "C"})

# مرزهای جمله و بند — برای اینکه وقفه‌ها سرجای خودشان بیفتند
HARD_BREAK = re.compile(r"(?<=[.!؟])\s+")
SOFT_BREAK = re.compile(r"(?<=[،؛:])\s+")


def log(*a):
    print(*a, flush=True)


# ══════════════════════════════════════════════════════════════
# ۱) دانلود فایل‌های مدل (با کش)
# ══════════════════════════════════════════════════════════════
def fetch_normalizer() -> Path:
    """normalize_fa.py را از هاگینگ‌فیس می‌گیرد."""
    from huggingface_hub import hf_hub_download

    path = hf_hub_download(repo_id=MODEL_REPO, filename="normalize_fa.py")
    log(f"✅ normalize_fa.py → {path}")
    return Path(path)


# ══════════════════════════════════════════════════════════════
# ۲) مرحلهٔ G2P — فارسی → فونِم
# ══════════════════════════════════════════════════════════════
class Phonemizer:
    """متن فارسی را به فونِم لاتین تبدیل می‌کند (Homo-GE2PE)."""

    def __init__(self, normalize_for_model):
        import torch
        from transformers import AutoTokenizer, T5ForConditionalGeneration

        self.torch = torch
        self.normalize = normalize_for_model
        log(f"⏳ بارگذاری G2P: {G2P_REPO}")
        g2p_dir = self._local_dir()
        self.tok = AutoTokenizer.from_pretrained(g2p_dir)
        self.g2p = T5ForConditionalGeneration.from_pretrained(
            G2P_REPO
        ).eval()
        log("✅ G2P آماده است")

    @staticmethod
    def _local_dir() -> str:
        """مدل G2P را محلی می‌گیرد و فایل توکنایزر را در صورت نیاز اصلاح می‌کند.

        ⚠️ دلیل این کار:
        مدل Homo-GE2PE مقدار extra_special_tokens را در tokenizer_config.json
        به شکل «لیست» ذخیره کرده، ولی transformers جدید آن را «دیکشنری»
        می‌خواهد و بدون این اصلاح با این خطا می‌افتد:
            AttributeError: 'list' object has no attribute 'keys'
        این محافظ مستقل از نسخهٔ transformers کار می‌کند.
        """
        import json
        import shutil
        import tempfile

        from huggingface_hub import snapshot_download

        src = snapshot_download(repo_id=G2P_REPO)
        cfg_path = Path(src) / "tokenizer_config.json"
        if not cfg_path.exists():
            log("ℹ️ tokenizer_config.json نبود — بدون اصلاح ادامه می‌دهیم")
            return src

        try:
            cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
        except Exception as exc:  # noqa: BLE001
            log(f"⚠️ خواندن tokenizer_config.json نشد ({exc})")
            return src

        est = cfg.get("extra_special_tokens")
        if not isinstance(est, list):
            return src  # از قبل دیکشنری است — مشکلی نیست

        # لیست → دیکشنری، و در یک کپی محلی بنویس (کش دست‌نخورده بماند)
        cfg["extra_special_tokens"] = {
            x: x for x in est if isinstance(x, str)
        }
        dst = Path(tempfile.mkdtemp(prefix="g2p_"))
        for item in Path(src).iterdir():
            if item.is_file():
                shutil.copy2(item, dst / item.name)
            else:
                shutil.copytree(item, dst / item.name, dirs_exist_ok=True)
        (dst / "tokenizer_config.json").write_text(
            json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        log(f"🔧 extra_special_tokens: لیست ({len(est)}) → دیکشنری اصلاح شد")
        return str(dst)

    def __call__(self, text: str) -> str:
        torch = self.torch
        # نرمال‌سازی اول — G2P برای رقم خواندن ندارد و بی‌صدا حذفشان می‌کند
        text = self.normalize(text)
        # «؟» در این نماد با ایست چاکنایی یکی است — حذفش کن
        text = text.replace("؟", "").replace("?", "")
        if not text.strip():
            return ""
        enc = self.tok([text], add_special_tokens=False, return_tensors="pt")
        with torch.no_grad():
            out = self.g2p.generate(
                **enc, num_beams=5, max_length=512, early_stopping=True
            )
        raw = self.tok.batch_decode(out, skip_special_tokens=True)[0].strip()
        # علامت «1» نشانهٔ اضافه است — مدل نباید ببیندش
        return raw.translate(TO_PHONEMES).replace("1", "")


# ══════════════════════════════════════════════════════════════
# ۳) تکه‌تکه کردن متن (برای وقفه‌های طبیعی)
# ══════════════════════════════════════════════════════════════
def split_sentences(text: str) -> list[str]:
    """به جمله و بعد بند می‌شکند. مدل روی جمله‌های کوتاه آموزش دیده."""
    text = " ".join(text.split())
    if not text:
        return []
    parts: list[str] = []
    for sentence in HARD_BREAK.split(text):
        sentence = sentence.strip()
        if not sentence:
            continue
        # جمله‌های بلند را روی ویرگول هم بشکن
        for clause in SOFT_BREAK.split(sentence):
            clause = clause.strip()
            if clause:
                parts.append(clause)
    return parts or [text]


def pack_chunks(pieces: list[str], max_words: int = 22) -> list[str]:
    """تکه‌های کوتاه را به هم می‌چسباند تا هر تکه به اندازهٔ کافی بلند باشد.

    مدل روی ~۱۱ فونِم آموزش دیده؛ تکهٔ ۲ کلمه‌ای بد خوانده می‌شود و
    تکهٔ ۲۱+ فونِمی ممکن است تمام نشود و تکرار کند.
    """
    out: list[str] = []
    for p in pieces:
        if out and len((out[-1] + " " + p).split()) <= max_words:
            out[-1] = out[-1] + " " + p
        else:
            out.append(p)
    # اگر آخرین تکه خیلی کوچک ماند، به قبلی بچسبانش
    if len(out) >= 2 and len(out[-1].split()) <= 3:
        out[-2] = out[-2] + " " + out[-1]
        out.pop()
    return out


# ══════════════════════════════════════════════════════════════
# ۴) تولید صدا
# ══════════════════════════════════════════════════════════════
def best_window(mono, sr, seconds=5.0, stride=1):
    """بهترین پنجرهٔ «ثانیه» ثانیه‌ای را از یک نمونهٔ بلندتر انتخاب می‌کند.

    ⚠️ چرا لازم است:
    مدل روی نمونهٔ ۵ ثانیه سقف خورده. اگر فقط ۵ ثانیهٔ اول فایل را
    برداریم، ممکن است سکوت یا نفس اولِ ضبط را بگیریم. اینجا پنجره‌ای
    انتخاب می‌شود که **بیشترین صدای پیوسته** را دارد.

    خروجی: (نمونهٔ بریده, اطلاعات پنجره)
    """
    import numpy as np

    n_samples = int(seconds * sr)
    if len(mono) <= n_samples:
        piece = mono
        detail = {"start": 0.0, "len": round(len(mono) / sr, 2), "score": 0.0}
    else:
        hop = max(1, int(0.1 * sr))          # پویش با گام ۱۰۰ میلی‌ثانیه
        win = n_samples
        # انرژی میانگین مربعات در هر نیم‌ثانیه
        half = max(1, sr // 2)
        n_half = len(mono) // half
        energy = np.array([
            float(np.sqrt(np.mean(mono[i * half:(i + 1) * half] ** 2)))
            for i in range(n_half)
        ]) if n_half else np.array([0.0])
        # بیشینهٔ انرژی در یک پنجرهٔ ۵ ثانیه‌ای (۱۰ نیم‌ثانیه)
        span = max(1, int(round(seconds * 2)))
        best_i, best_score = 0, -1.0
        for i in range(0, max(1, n_half - span + 1)):
            block = energy[i:i + span]
            # میانگین وزنی: میانگین انرژی منهای جریمهٔ سکوت
            mean_e = float(block.mean()) if block.size else 0.0
            silent = float((block < 0.02 * (energy.max() or 1)).mean()) if block.size else 1.0
            score = mean_e * (1.0 - 0.5 * silent)
            if score > best_score:
                best_score, best_i = score, i
        start = min(best_i * half, max(0, len(mono) - win))
        # گام‌بندی روی مضرب hop تا پنجره پایدار بماند
        start = (start // hop) * hop
        piece = mono[start:start + win]
        detail = {"start": round(start / sr, 2), "len": round(len(piece) / sr, 2),
                  "score": round(best_score, 5)}

    if stride > 1:
        usable = (len(piece) // stride) * stride
        piece = piece[:usable]
    return piece.astype("float32"), detail


def synth(
    text: str,
    voice: Path,
    out_path: Path,
    voice_sec: float = 5.0,
    pause_sec: float = 0.25,
) -> dict:
    import numpy as np

    t0 = time.time()

    # ── بارگذاری ابزارها ──
    normalize_path = fetch_normalizer()
    sys.path.insert(0, str(normalize_path.parent))
    from normalize_fa import normalize_for_model  # type: ignore
    log("✅ normalize_fa بارگذاری شد")

    phonemizer = Phonemizer(normalize_for_model)

    from pocket_tts import TTSModel

    # ⚠️ مهم: باید فرم hf:// بدهیم، نه مسیر فایل لوکال.
    # model.yaml به model.safetensors و tokenizer_ph.model «نسبی» اشاره
    # می‌کند؛ اگر فایل را جدا دانلود کنیم و مسیرش را بدهیم، آن‌ها پیدا
    # نمی‌شوند و بارگذاری مدل شکست می‌خورد.
    config_uri = os.environ.get("TTS_CONFIG") or f"hf://{MODEL_REPO}/model.yaml"
    log(f"⏳ بارگذاری مدل گفتار… ({config_uri})")
    model = TTSModel.load_model(config=config_uri, temp=0.3, eos_threshold=-2.0)
    log("✅ مدل گفتار آماده است")

    sample_rate = int(model.mimi.sample_rate)

    # ── نمونهٔ صدا: حداکثر ۵ ثانیه + طول مضرب stride ──
    #   ⚠️ دو قید مهم:
    #   ۱) آموزش روی نمونهٔ ۵ ثانیه سقف خورده؛ بلندتر = مدل ادامهٔ
    #      جملهٔ خودتان را می‌گوید به‌جای متن شما.
    #   ۲) طول نمونه باید مضربِ stride رمزگذار Mimi باشد، وگرنه:
    #        AssertionError: Steps must be multiple of stride
    #      ۵ ثانیه × ۲۴۰۰۰ = ۱۲۰۰۰۰ و ۱۲۰۰۰۰ ÷ ۱۹۲۰ = ۶۲.۵ ✗
    # ── آماده‌سازی نمونه‌های صدا ──
    #   ⚠️ مدل روی نمونهٔ ۵ ثانیه سقف خورده (max_voice_prompt_sec=5.0).
    #      نمونهٔ بلندتر = مدل ادامهٔ جملهٔ خودتان را می‌گوید.
    #      پس از هر نمونهٔ بلند، «بهترین پنجرهٔ ۵ ثانیه» را برمی‌داریم.
    #   ✅ چند نمونه مفید است: از هرکدام بهترین پنجره انتخاب می‌شود و
    #      با همه تولید می‌کنیم و بهترین خروجی را نگه می‌داریم.
    voice_list = [voice] if isinstance(voice, (str, Path)) else list(voice)
    voice_list = [Path(v) for v in voice_list]
    for v in voice_list:
        if not v.exists():
            raise SystemExit(f"❌ فایل صدا پیدا نشد: {v}")

    stride = int(round(sample_rate / float(getattr(model.mimi, "frame_rate", 12.5) or 12.5)))
    log(f"🔧 sample_rate={sample_rate} | stride={stride} | {len(voice_list)} نمونهٔ صدا")

    import tempfile

    import numpy as np
    import soundfile as sf

    prompts = []
    for idx, v in enumerate(voice_list, 1):
        try:
            data, sr = sf.read(str(v), always_2d=True)
            mono = data.mean(axis=1).astype(np.float32)
            if sr != sample_rate:
                i2 = np.linspace(0, len(mono) - 1, int(len(mono) * sample_rate / sr))
                mono = np.interp(i2, np.arange(len(mono)), mono).astype(np.float32)
                sr = sample_rate
            dur_in = len(mono) / sr
            piece, det = best_window(mono, sr, voice_sec if voice_sec and voice_sec > 0 else 5.0, stride)
            tmp = Path(tempfile.mkdtemp()) / f"voice_prompt_{idx}.wav"
            sf.write(str(tmp), piece, sr)
            prompts.append(str(tmp))
            log(f"✅ نمونهٔ {idx}: {v.name} | ورودی {dur_in:.1f}s → "
                f"{len(piece) / sr:.2f}s از ثانیهٔ {det['start']} "
                f"(مضرب {stride})")
        except Exception as exc:  # noqa: BLE001
            log(f"⚠️ نمونهٔ {idx} آماده نشد ({exc}) — رد شد")

    if not prompts:
        raise SystemExit("❌ هیچ نمونهٔ صدای سالمی آماده نشد")
    prompt = prompts[0]

    # ── تکه‌تکه ──
    sentences = split_sentences(text)
    chunks = pack_chunks(sentences)
    log(f"📝 {len(chunks)} تکه:")
    for i, c in enumerate(chunks, 1):
        log(f"   [{i}] {c}")

    # ── فونِم‌سازی همهٔ تکه‌ها ──
    phon_chunks = []
    for i, chunk in enumerate(chunks, 1):
        ph = phonemizer(chunk)
        if not ph.strip():
            log(f"⚠️ تکهٔ {i} فونِم خالی داد — رد شد")
            continue
        log(f"🔊 [{i}/{len(chunks)}] {len(ph.split())} فونِم: {ph}")
        phon_chunks.append(ph)
    if not phon_chunks:
        raise SystemExit("❌ هیچ فونِمی ساخته نشد — متن را بررسی کنید")

    gap = np.zeros(int(pause_sec * sample_rate), dtype=np.float32)

    # ── با هر نمونهٔ صدا تولید کن و بهترین را بردار ──
    #    ✅ این همان «تقویت با چند نمونه» است: هر نمونه یک حالت صوتی
    #       متفاوت می‌دهد؛ بهترین را از نظر پرسوزی و طول معقول برمی‌داریم.
    expected_sec = max(1.5, len(text.split()) / 2.5)
    best = None
    for pi, pr in enumerate(prompts, 1):
        try:
            state = model.get_state_for_audio_prompt(pr)
            pieces = []
            for i, ph in enumerate(phon_chunks, 1):
                audio = model.generate_audio(state, ph, frames_after_eos=0)
                arr = np.asarray(audio, dtype=np.float32).reshape(-1)
                pieces.append(arr)
                if i < len(phon_chunks):
                    pieces.append(gap)
            cand = np.concatenate(pieces)
            dur = len(cand) / sample_rate
            rms = float(np.sqrt((cand ** 2).mean())) if cand.size else 0.0
            dev = abs(dur - expected_sec) / expected_sec
            log(f"🎙 نمونهٔ {pi}: {dur:.1f}s | RMS {rms:.4f} | "
                f"انتظار ~{expected_sec:.1f}s | انحراف {dev:.2f}")
            score = (1.0 if rms > 0.001 else 0.0, -dev)
            if best is None or score > best[0]:
                best = (score, cand, pi)
        except Exception as exc:  # noqa: BLE001
            log(f"⚠️ نمونهٔ {pi} تولید نکرد ({exc})")

    if best is None:
        raise SystemExit("❌ هیچ صدایی تولید نشد")
    final = best[1]
    log(f"🏆 بهترین نمونه: شمارهٔ {best[2]}")
    out_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        import sphn

        sphn.write_wav(str(out_path), final, sample_rate)
    except Exception:  # noqa: BLE001
        from scipy.io import wavfile

        wavfile.write(str(out_path), sample_rate, final)

    dur = len(final) / sample_rate
    log(f"✅ نوشته شد: {out_path}  ({dur:.1f} ثانیه، {time.time() - t0:.0f}s طول کشید)")
    return {
        "dur": round(dur, 2),
        "chunks": len(chunks),
        "sample_rate": sample_rate,
        "seconds_taken": round(time.time() - t0, 1),
    }


# ══════════════════════════════════════════════════════════════
# ۵) به‌روزرسانی فهرست صداها (برای صفحهٔ سایت)
# ══════════════════════════════════════════════════════════════
def update_index(entry: dict) -> None:
    idx_path = OUT_DIR / "index.json"
    data = {"items": []}
    if idx_path.exists():
        try:
            data = json.loads(idx_path.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            data = {"items": []}
    items = [i for i in data.get("items", []) if i.get("file") != entry["file"]]
    items.insert(0, entry)
    data["items"] = items[:200]
    data["updated"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    idx_path.parent.mkdir(parents=True, exist_ok=True)
    idx_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    log(f"✅ index.json به‌روز شد ({len(data['items'])} مورد)")


def main() -> int:
    ap = argparse.ArgumentParser(description="تولید گفتار فارسی با صدای کلون‌شده")
    ap.add_argument("--text", help="متن فارسی")
    ap.add_argument("--text-file", help="فایل متنی")
    ap.add_argument("--voice", action="append",
                    help="نمونهٔ صدا (می‌تواند چند بار بیاید). "
                         "پیش‌فرض: همهٔ فایل‌های ai/voices/*.ogg|wav")
    ap.add_argument("--out", help="فایل خروجی wav")
    ap.add_argument("--name", help="نام فایل خروجی (بدون پسوند)")
    ap.add_argument("--voice-sec", type=float, default=5.0)
    ap.add_argument("--pause-sec", type=float, default=0.25)
    ap.add_argument("--no-index", action="store_true", help="index.json را به‌روز نکن")
    args = ap.parse_args()

    if args.text_file:
        text = Path(args.text_file).read_text(encoding="utf-8")
    elif args.text:
        text = args.text
    else:
        text = os.environ.get("TTS_TEXT", "")
    if not text.strip():
        log("❌ متنی داده نشد. --text یا --text-file یا TTS_TEXT")
        return 2

    # ── نمونه‌های صدا ──
    #    اگر نداده باشد، همهٔ فایل‌های صوتی ai/voices را برمی‌دارد
    #    (به‌جز نمونهٔ آزمایشی مدل).
    if args.voice:
        voices = [Path(v) if Path(v).is_absolute() else ROOT / v for v in args.voice]
    else:
        vdir = ROOT / "ai" / "voices"
        voices = sorted(
            p for p in vdir.glob("*")
            if p.suffix.lower() in (".ogg", ".wav", ".mp3", ".m4a")
            and not p.name.startswith("_")
        )
    voices = [v for v in voices if v.exists()]
    if not voices:
        log("❌ هیچ نمونهٔ صدایی پیدا نشد در ai/voices/")
        return 2
    log(f"🎙 {len(voices)} نمونهٔ صدا: " + " , ".join(v.name for v in voices))

    stem = args.name or time.strftime("clip_%Y%m%d_%H%M%S", time.gmtime())
    out_path = Path(args.out) if args.out else OUT_DIR / f"{stem}.wav"
    if not out_path.is_absolute():
        out_path = ROOT / out_path

    info = synth(text, voices, out_path, args.voice_sec, args.pause_sec)

    if not args.no_index:
        rel = out_path.relative_to(ROOT).as_posix()
        update_index({
            "file": rel,
            "text": text.strip()[:400],
            "voice": Path(args.voice).name,
            "at": time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime()),
            **info,
        })

    # برای خواندن در ورکفلو
    out_file = os.environ.get("GITHUB_OUTPUT")
    if out_file:
        with open(out_file, "a", encoding="utf-8") as fh:
            fh.write(f"wav={out_path}\n")
            fh.write(f"name={stem}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
