"""Local HTTP API for the Farsi TTS, plus a small web UI for testing.

Run it and point your software at it:

    python server.py                 # http://127.0.0.1:8123
    python server.py --port 9000 --host 0.0.0.0

Endpoints (interactive docs at /docs):

    GET    /api/health             is the model loaded, what voices exist
    GET    /api/voices             list voice names
    POST   /api/voices/{name}      upload 2-5 s of speech (multipart "file")
    DELETE /api/voices/{name}      remove a voice
    POST   /api/tts                {"text": "...", "voice": "me"} -> audio/wav
    POST   /api/phonemes           {"text": "..."} -> phonemes + chunk plan

The model is not thread-safe, so generation is serialised; concurrent callers
queue behind a lock instead of corrupting each other's state.
"""

from __future__ import annotations

import argparse
import base64
import logging
import os
import threading
import time
from pathlib import Path

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, Response
from pydantic import BaseModel, Field

from . import audio_io, paths
from .engine import FarsiTTS, Settings, get_engine

logger = logging.getLogger("farsi_tts.server")

WEB_DIR = Path(__file__).resolve().parent / "web"

# Enrollment rewrites the voice the whole service speaks with, so on a public
# deployment it must be protected. Set TTS_ADMIN_TOKEN to require the
# `X-Admin-Token` header; leave it unset and everything is open (local use).
ADMIN_TOKEN = os.environ.get("TTS_ADMIN_TOKEN", "").strip()


def _require_admin(token: str | None) -> None:
    if not ADMIN_TOKEN:
        return
    if not token or token != ADMIN_TOKEN:
        raise HTTPException(401, "enrollment is protected: send X-Admin-Token")


class TTSRequest(BaseModel):
    text: str = Field(..., description="Persian (Farsi) text in Persian script")
    voice: str | None = Field(None, description="voice name, or a path/URL to a wav")
    # "wav" streams the audio back; "base64" wraps it in JSON for clients that
    # cannot handle binary responses.
    format: str = Field("wav", pattern="^(wav|base64)$")
    temperature: float | None = Field(None, ge=0.05, le=1.5)
    eos_threshold: float | None = Field(None, ge=-10.0, le=0.0)
    max_tokens: int | None = Field(None, ge=8, le=24)
    voice_sec: float | None = Field(None, ge=1.0, le=10.0)
    pause_sec: float | None = Field(None, ge=0.0, le=2.0)
    join_sec: float | None = Field(None, ge=0.0, le=1.0)


class PhonemeRequest(BaseModel):
    text: str


def _settings_from(request: TTSRequest, base: Settings) -> Settings:
    overrides = {
        key: getattr(request, key)
        for key in ("temperature", "eos_threshold", "max_tokens", "voice_sec",
                    "pause_sec", "join_sec")
        if getattr(request, key) is not None
    }
    return Settings(**{**base.__dict__, **overrides}) if overrides else base


def create_app(engine: FarsiTTS | None = None, preload: bool = True) -> FastAPI:
    app = FastAPI(
        title="Pocket-TTS Farsi v2",
        description="Persian text-to-speech with voice cloning, on CPU.",
        version="1.0.0",
    )
    # A static site (GitHub Pages) on another origin has to be able to call this,
    # so CORS is wide open on purpose: the service is a read-mostly public TTS
    # endpoint, and enrollment is protected by TTS_ADMIN_TOKEN instead.
    from fastapi.middleware.cors import CORSMiddleware

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["X-Sample-Rate", "X-Audio-Seconds", "X-Voice", "X-Chunks",
                        "X-Generation-Seconds"],
    )
    tts = engine or get_engine()
    state = {"ready": False, "loading": False, "error": None, "loaded_at": None}
    load_lock = threading.Lock()

    def ensure_loaded() -> None:
        with load_lock:
            if state["ready"] or state["loading"]:
                return
            state["loading"] = True
        try:
            tts.load(progress=lambda message: logger.info("%s", message))
            state["ready"] = True
            state["loaded_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
        except Exception as exc:  # surfaced through /api/health
            state["error"] = f"{type(exc).__name__}: {exc}"
            logger.exception("model load failed")
        finally:
            state["loading"] = False

    if preload:
        threading.Thread(target=ensure_loaded, name="preload", daemon=True).start()

    @app.get("/", response_class=HTMLResponse)
    def index() -> HTMLResponse:
        page = WEB_DIR / "index.html"
        if not page.is_file():
            return HTMLResponse("<h1>Pocket-TTS Farsi</h1><p>API is up. See /docs.</p>")
        return HTMLResponse(page.read_text(encoding="utf-8"))

    @app.get("/api/health")
    def health() -> JSONResponse:
        return JSONResponse({
            "status": "ok" if state["ready"] else ("loading" if state["loading"] else "idle"),
            "model": tts.model_id,
            "g2p": tts.g2p_id,
            "device": tts.device,
            "sample_rate": paths.SAMPLE_RATE,
            "voices": tts.list_voices(),
            "default_voice": paths.DEFAULT_VOICE,
            "loaded_at": state["loaded_at"],
            "error": state["error"],
        })

    @app.get("/api/voices")
    def voices() -> JSONResponse:
        items = []
        for name in tts.list_voices():
            stored = paths.VOICES_DIR / f"{name}.wav"
            exported = paths.VOICES_DIR / f"{name}.safetensors"
            items.append({
                "name": name,
                "builtin": name in paths.BUILTIN_VOICES and not stored.is_file(),
                "prompt": str(stored) if stored.is_file() else None,
                "exported": exported.is_file(),
            })
        return JSONResponse({"voices": items, "default": paths.DEFAULT_VOICE})

    @app.post("/api/voices/{name}")
    def enroll(name: str, file: UploadFile = File(...),
               seconds: float = Form(5.0), trim: bool = Form(False),
               x_admin_token: str | None = Header(None)) -> JSONResponse:
        _require_admin(x_admin_token)
        if not name.replace("_", "").replace("-", "").isalnum():
            raise HTTPException(400, "voice name may contain letters, digits, - and _ only")
        data = file.file.read()
        if not data:
            raise HTTPException(400, "empty upload")
        suffix = Path(file.filename or "voice.wav").suffix or ".wav"
        staging = paths.OUTPUT_DIR / f"_upload_{int(time.time() * 1000)}{suffix}"
        staging.write_bytes(data)
        try:
            target = tts.enroll(name, staging, seconds=seconds, trim=trim)
        except Exception as exc:
            raise HTTPException(400, f"could not use that recording: {exc}") from exc
        finally:
            staging.unlink(missing_ok=True)
        return JSONResponse({"ok": True, "name": name, "path": str(target),
                             "seconds": seconds})

    @app.delete("/api/voices/{name}")
    def delete_voice(name: str, x_admin_token: str | None = Header(None)) -> JSONResponse:
        _require_admin(x_admin_token)
        removed = []
        for suffix in (".wav", ".safetensors"):
            path = paths.VOICES_DIR / f"{name}{suffix}"
            if path.is_file():
                path.unlink()
                removed.append(path.name)
        if not removed:
            raise HTTPException(404, f"no stored voice named {name!r}")
        tts._voice_cache.clear()
        return JSONResponse({"ok": True, "removed": removed})

    @app.post("/api/phonemes")
    def phonemes(request: PhonemeRequest) -> JSONResponse:
        ensure_loaded()
        if state["error"]:
            raise HTTPException(500, state["error"])
        try:
            plan, sentences = tts.plan(request.text, tts.settings)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
        return JSONResponse({
            "sentences": sentences,
            "chunks": [{"phonemes": tts.strip_ezafe(chunk), "boundary": boundary,
                        "tokens": tts.count_tokens(chunk)} for chunk, boundary in plan],
            "phonemes": " ".join(tts.strip_ezafe(chunk) for chunk, _ in plan),
        })

    @app.post("/api/tts")
    def synthesize(request: TTSRequest) -> Response:
        ensure_loaded()
        if state["error"]:
            raise HTTPException(500, state["error"])
        started = time.time()
        try:
            result = tts.synthesize(
                request.text,
                request.voice,
                settings=_settings_from(request, tts.settings),
            )
        except FileNotFoundError as exc:
            raise HTTPException(404, str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc

        headers = {
            "X-Sample-Rate": str(result.sample_rate),
            "X-Audio-Seconds": f"{result.seconds:.2f}",
            "X-Voice": Path(result.voice).stem if result.voice else "",
            "X-Chunks": str(len(result.chunks)),
            "X-Generation-Seconds": f"{time.time() - started:.2f}",
            "Access-Control-Expose-Headers": (
                "X-Sample-Rate, X-Audio-Seconds, X-Voice, X-Chunks, X-Generation-Seconds"
            ),
            # Any browser front-end may call this directly.
            "Access-Control-Allow-Origin": "*",
        }
        if request.format == "base64":
            return JSONResponse({
                "audio_base64": base64.b64encode(
                    audio_io.wav_bytes(result.audio, result.sample_rate)
                ).decode("ascii"),
                "sample_rate": result.sample_rate,
                "seconds": round(result.seconds, 3),
                "phonemes": result.phonemes,
                "chunks": result.chunks,
                "voice": headers["X-Voice"],
                "warnings": result.warnings,
                "elapsed": round(result.elapsed, 3),
            }, headers=headers)
        return Response(
            content=audio_io.wav_bytes(result.audio, result.sample_rate),
            media_type="audio/wav",
            headers=headers,
        )

    @app.options("/api/tts")
    def tts_preflight() -> Response:
        return Response(headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        })

    return app


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Pocket-TTS Farsi v2 local server")
    parser.add_argument("--host", default="127.0.0.1",
                        help="use 0.0.0.0 to reach it from other devices on your network")
    parser.add_argument("--port", type=int, default=8123)
    parser.add_argument("--device", default="cpu", help="cpu, or cuda when torch was built with it")
    parser.add_argument("--no-preload", action="store_true",
                        help="do not load the model until the first request")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )

    import uvicorn

    app = create_app(FarsiTTS(device=args.device), preload=not args.no_preload)
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
