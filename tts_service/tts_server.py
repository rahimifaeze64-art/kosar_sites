#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tts_server.py — سرویس محلی تبدیل متن به گفتار فارسی (pocket-tts-farsi)

مدل: mehdi-hf/pocket-tts-farsi  (MIT، اجرا روی CPU، پشتیبانی از Voice Cloning)
خروجی: WAV 16-bit mono

نصب:
    pip install -r tts_service/requirements.txt
    (یا: pip install pocket-tts soundfile torch numpy)

اجرا:
    python tts_service/tts_server.py
    python tts_service/tts_server.py --port 8765 --voice my_voice.wav
    python tts_service/tts_server.py --text "سلام" --out out.wav   # تست سریع

API:
    GET  /health         → وضعیت سرویس
    GET  /voices         → لیست صداهای محلی پوشه voices/
    POST /tts            → بدنه JSON: {"text": "...", "voice": "اختیاری"}
                           پاسخ: audio/wav

نکته: متن به قطعه‌های کوتاه (زیر ~۱۸ توکن) شکسته می‌شود تا مدل گیر نکند.
"""

import argparse
import io
import json
import os
import sys
import traceback
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
if _THIS_DIR not in sys.path:
    sys.path.insert(0, _THIS_DIR)

# کنسول ویندوز (cp1252/cp437) نمی‌تواند فارسی چاپ کند → UTF-8
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except Exception:
        pass

from normalize_fa import normalize, chunk_text  # noqa: E402

try:
    import numpy as np
except Exception:  # pragma: no cover
    np = None

# ── تنظیمات ───────────────────────────────────────────────────
MODEL_CONFIG = os.environ.get("TTS_MODEL_CONFIG", "hf://mehdi-hf/pocket-tts-farsi/farsi.yaml")
DEFAULT_VOICE = os.environ.get(
    "TTS_VOICE",
    "hf://mehdi-hf/pocket-tts-farsi/example_voice.wav",  # صدای نمونه خود مدل (بهترین کیفیت)
)
VOICES_DIR = os.path.join(_THIS_DIR, "voices")
SILENCE_SECONDS = 0.15
TEMPERATURE = 0.3
EOS_THRESHOLD = -2
MAX_WORDS = 16
DEFAULT_SAMPLE_RATE = 24000

_model = None
_voice_cache = {}
_voice_overridden = None


# ── مدل ───────────────────────────────────────────────────────
def get_model():
    global _model
    if _model is not None:
        return _model

    try:
        from pocket_tts import TTSModel
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(
            "پکیج pocket-tts نصب نیست. اجرا کن:\n"
            "    pip install -r tts_service/requirements.txt\n"
            f"جزئیات: {exc}"
        )

    print(f"[tts] در حال بارگذاری مدل: {MODEL_CONFIG}")
    try:
        _model = TTSModel.load_model(config=MODEL_CONFIG, temp=TEMPERATURE)
    except TypeError:
        _model = TTSModel.load_model(MODEL_CONFIG)
    print(f"[tts] مدل آماده شد | sample_rate={getattr(_model, 'sample_rate', '?')}")
    return _model


def _resolve_voice(voice):
    if not voice:
        return _voice_overridden or DEFAULT_VOICE
    if voice.startswith(("hf://", "http://", "https://")) or os.path.isabs(voice):
        return voice
    local = os.path.join(VOICES_DIR, voice)
    if os.path.exists(local):
        return local
    for ext in (".wav", ".flac", ".mp3"):
        if os.path.exists(local + ext):
            return local + ext
    print(f"[tts] صدای محلی «{voice}» پیدا نشد؛ از صدای پیش‌فرض استفاده می‌شود")
    return _voice_overridden or DEFAULT_VOICE


def get_voice_state(voice):
    path = _resolve_voice(voice)
    if path not in _voice_cache:
        model = get_model()
        print(f"[tts] بارگذاری صدای مرجع: {path}")
        _voice_cache[path] = model.get_state_for_audio_prompt(path)
    return _voice_cache[path]


# ── تولید صدا ─────────────────────────────────────────────────
def _generate_one(state, text):
    model = get_model()
    try:
        return model.generate_audio(state, text, frames_after_eos=0, eos_threshold=EOS_THRESHOLD)
    except TypeError:
        return model.generate_audio(state, text, frames_after_eos=0)


def _to_numpy(audio):
    if np is None:
        raise RuntimeError("numpy لازم است. pip install numpy")
    if hasattr(audio, "detach"):
        audio = audio.detach().cpu().numpy()
    arr = np.asarray(audio, dtype=np.float32)
    return np.squeeze(arr)


def _wav_bytes(arr, sample_rate):
    if np is None:
        raise RuntimeError("numpy لازم است. pip install numpy")
    pcm = np.clip(np.asarray(arr, dtype=np.float32), -1.0, 1.0)
    pcm = (pcm * 32767.0).astype("<i2")
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(int(sample_rate))
        w.writeframes(pcm.tobytes())
    return buf.getvalue()


def synth(text, voice=None):
    """متن → bytes فایل WAV (16-bit)."""
    normalized = normalize(text)
    chunks = chunk_text(normalized, max_words=MAX_WORDS)
    if not chunks:
        raise ValueError("متن ورودی خالی است")

    model = get_model()
    state = get_voice_state(voice)
    sample_rate = int(getattr(model, "sample_rate", 0) or DEFAULT_SAMPLE_RATE)

    pieces = []
    for i, chunk in enumerate(chunks, 1):
        try:
            audio = _generate_one(state, chunk)
        except Exception as exc:  # noqa: BLE001
            print(f"[tts] قطعه {i} خطا داد ({exc})؛ تلاش مجدد…")
            audio = _generate_one(state, chunk)
        pieces.append(_to_numpy(audio))

    silence = np.zeros(int(sample_rate * SILENCE_SECONDS), dtype=np.float32)
    parts = []
    for i, piece in enumerate(pieces):
        if i:
            parts.append(silence)
        parts.append(piece)
    full = np.concatenate(parts) if parts else np.zeros(0, dtype=np.float32)
    return _wav_bytes(full, sample_rate)


def list_voices():
    names = []
    if os.path.isdir(VOICES_DIR):
        for f in sorted(os.listdir(VOICES_DIR)):
            if f.lower().endswith((".wav", ".flac", ".mp3")):
                names.append(f)
    return names


# ── HTTP ──────────────────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):
    server_version = "PocketTTSFarsi/1.0"

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        try:
            self.wfile.write(body)
        except BrokenPipeError:
            pass

    def _wav(self, data):
        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self._cors()
        self.end_headers()
        try:
            self.wfile.write(data)
        except BrokenPipeError:
            pass

    def do_OPTIONS(self):  # noqa: N802
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):  # noqa: N802
        if self.path.startswith("/health"):
            sr = None
            if _model is not None:
                sr = getattr(_model, "sample_rate", None)
            self._json(200, {
                "ok": True,
                "engine": "pocket-tts-farsi",
                "model": MODEL_CONFIG,
                "model_loaded": _model is not None,
                "sample_rate": sr,
                "default_voice": _voice_overridden or DEFAULT_VOICE,
                "voices": list_voices(),
            })
            return
        if self.path.startswith("/voices"):
            self._json(200, {"voices": list_voices(), "default": _voice_overridden or DEFAULT_VOICE})
            return
        self._json(404, {"error": "not found"})

    def do_POST(self):  # noqa: N802
        if not self.path.startswith("/tts"):
            self._json(404, {"error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(length) if length else b"{}"
            payload = json.loads(raw.decode("utf-8") or "{}")
        except Exception as exc:  # noqa: BLE001
            self._json(400, {"error": "bad json", "detail": str(exc)})
            return

        text = (payload.get("text") or "").strip()
        if not text:
            self._json(400, {"error": "text is required"})
            return

        try:
            data = synth(text, payload.get("voice"))
        except Exception as exc:  # noqa: BLE001
            traceback.print_exc()
            self._json(500, {"error": str(exc)})
            return
        self._wav(data)

    def log_message(self, fmt, *args):  # noqa: A003
        print("[tts] " + (fmt % args))


def main():
    global _voice_overridden

    parser = argparse.ArgumentParser(description="سرویس محلی TTS فارسی (pocket-tts-farsi)")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--voice", default=None, help="فایل صوتی مرجع (Voice Cloning) یا نام در پوشه voices/")
    parser.add_argument("--text", default=None, help="حالت تست: متن را به فایل WAV تبدیل کن و خارج شو")
    parser.add_argument("--out", default="out.wav", help="مسیر خروجی در حالت --text")
    parser.add_argument("--no-preload", action="store_true", help="مدل را در شروع لود نکن")
    args = parser.parse_args()

    if args.voice:
        _voice_overridden = args.voice

    if args.text:
        print("[tts] حالت تست…")
        with open(args.out, "wb") as f:
            f.write(synth(args.text, args.voice))
        print(f"[tts] خروجی ذخیره شد: {args.out}")
        return

    if not args.no_preload:
        try:
            get_model()
            get_voice_state(None)
        except Exception as exc:  # noqa: BLE001
            print("[tts] شروع سرویس ناموفق بود:")
            print(str(exc))
            sys.exit(1)

    os.makedirs(VOICES_DIR, exist_ok=True)
    httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"[tts] سرویس روی http://{args.host}:{args.port} آماده است")
    print(f"[tts] صداهای محلی: {list_voices() or '—'}  (پوشه voices/)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[tts] خاموش شد")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
