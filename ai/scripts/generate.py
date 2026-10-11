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
    if not voice.exists():
        raise SystemExit(f"❌ فایل صدا پیدا نشد: {voice}")

    stride = int(round(sample_rate / float(getattr(model.mimi, "frame_rate", 12.5) or 12.5)))
    log(f"🔧 sample_rate={sample_rate} | stride={stride}")
    prompt = str(voice)
    try:
        import tempfile

        import numpy as np
        import soundfile as sf

        data, sr = sf.read(str(voice), always_2d=True)
        mono = data.mean(axis=1).astype(np.float32)
        if sr != sample_rate:
            # نمونه‌برداری مجدد سادهٔ خطی (کافی برای نمونهٔ صدا)
            idx = np.linspace(0, len(mono) - 1, int(len(mono) * sample_rate / sr))
            mono = np.interp(idx, np.arange(len(mono)), mono).astype(np.float32)
            log(f"🔁 نرخ نمونه {sr} → {sample_rate}")
            sr = sample_rate

        keep = int(voice_sec * sr) if voice_sec and voice_sec > 0 else len(mono)
        mono = mono[:keep]

        # بریدن به مضرب stride — این همان خطای AssertionError را رفع می‌کند
        if stride > 1:
            usable = (len(mono) // stride) * stride
            if usable != len(mono):
                log(f"✂️ طول نمونه {len(mono)} → {usable} نمونه "
                    f"(مضرب {stride})")
                mono = mono[:usable]

        trimmed = Path(tempfile.mkdtemp()) / "voice_prompt.wav"
        sf.write(str(trimmed), mono, sr)
        prompt = str(trimmed)
        log(f"✅ نمونهٔ صدا آماده: {len(mono)} نمونه = {len(mono) / sr:.2f} ثانیه")
    except Exception as exc:  # noqa: BLE001
        log(f"⚠️ آماده‌سازی نمونهٔ صدا نشد ({exc}) — فایل خام استفاده می‌شود")

    # ── تکه‌تکه ──
    sentences = split_sentences(text)
    chunks = pack_chunks(sentences)
    log(f"📝 {len(chunks)} تکه:")
    for i, c in enumerate(chunks, 1):
        log(f"   [{i}] {c}")

    state = model.get_state_for_audio_prompt(prompt)
    gap = np.zeros(int(pause_sec * sample_rate), dtype=np.float32)

    pieces = []
    for i, chunk in enumerate(chunks, 1):
        phonemes = phonemizer(chunk)
        if not phonemes.strip():
            log(f"⚠️ تکهٔ {i} فونِم خالی داد — رد شد")
            continue
        log(f"🔊 [{i}/{len(chunks)}] {len(phonemes.split())} فونِم: {phonemes}")
        audio = model.generate_audio(state, phonemes, frames_after_eos=0)
        arr = np.asarray(audio, dtype=np.float32).reshape(-1)
        pieces.append(arr)
        if i < len(chunks):
            pieces.append(gap)

    if not pieces:
        raise SystemExit("❌ هیچ صدایی تولید نشد — متن را بررسی کنید")

    final = np.concatenate(pieces)
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
    ap.add_argument("--voice", default="ai/voices/my_voice.wav", help="نمونهٔ صدا (۵ ثانیه)")
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

    voice = Path(args.voice)
    if not voice.is_absolute():
        voice = ROOT / voice

    stem = args.name or time.strftime("clip_%Y%m%d_%H%M%S", time.gmtime())
    out_path = Path(args.out) if args.out else OUT_DIR / f"{stem}.wav"
    if not out_path.is_absolute():
        out_path = ROOT / out_path

    info = synth(text, voice, out_path, args.voice_sec, args.pause_sec)

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
