"""Paths, environment wiring and the Persian normaliser loader.

This module has import-time side effects on purpose: ``HF_HOME`` and
``sys.path`` must be set *before* ``huggingface_hub`` / ``pocket_tts`` are
imported, otherwise the models land in the user's global cache instead of this
folder. Import it first — ``farsi_tts/engine.py`` does.
"""

from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent.parent
SRC_DIR = APP_DIR / "src" / "pocket-tts-main"


def _env_path(name: str, default: Path) -> Path:
    value = os.environ.get(name)
    return Path(value).expanduser().resolve() if value else default


# Everything the app writes lives under APP_DIR by default, so the folder can be
# copied to another machine and keep working.
VOICES_DIR = _env_path("FARSI_TTS_VOICES", APP_DIR / "voices")
OUTPUT_DIR = _env_path("FARSI_TTS_OUTPUT", APP_DIR / "output")
MODELS_DIR = _env_path("FARSI_TTS_MODELS", APP_DIR / "models")
HF_CACHE_DIR = MODELS_DIR / "hf"

# v2 is trained on romanised phonemes, so it needs the separate G2P frontend.
MODEL_ID = os.environ.get("FARSI_TTS_MODEL", "mehdi-hf/pocket-tts-farsi-v2")
MODEL_CONFIG = os.environ.get("FARSI_TTS_CONFIG", f"hf://{MODEL_ID}/model.yaml")
G2P_ID = os.environ.get("FARSI_TTS_G2P", "mehdi-hf/Homo-GE2PE-Persian-HF")

SAMPLE_RATE = 24000


def _configure_env() -> None:
    for directory in (VOICES_DIR, OUTPUT_DIR, MODELS_DIR, HF_CACHE_DIR):
        directory.mkdir(parents=True, exist_ok=True)

    # setdefault: an explicit HF_HOME from the caller (or a machine-wide cache)
    # always wins over ours.
    os.environ.setdefault("HF_HOME", str(HF_CACHE_DIR))
    os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
    # Offline switch for a machine that has the weights already but no internet.
    if os.environ.get("FARSI_TTS_OFFLINE") == "1":
        os.environ["HF_HUB_OFFLINE"] = "1"
        os.environ["TRANSFORMERS_OFFLINE"] = "1"


def _configure_sys_path() -> None:
    # `training.farsi.normalize_fa` lives in the vendored fork; it is the module
    # the model was trained and validated with, so we use it rather than a copy.
    if SRC_DIR.is_dir() and str(SRC_DIR) not in sys.path:
        sys.path.insert(0, str(SRC_DIR))


_configure_env()
_configure_sys_path()


def load_normalize_for_model():
    """Return ``normalize_for_model`` from the vendored fork's Farsi pipeline.

    Three layouts are supported, in order:
      1. the fork importable as a package (editable install) — `training.farsi`,
      2. `normalize_fa.py` copied next to this app (how the Docker/HF Space
         image ships it, where the fork's source tree is not present),
      3. the vendored source tree under `src/pocket-tts-main`.
    """
    try:
        from training.farsi.normalize_fa import normalize_for_model  # type: ignore

        return normalize_for_model
    except Exception:
        pass

    for path in (APP_DIR / "normalize_fa.py",
                 SRC_DIR / "training" / "farsi" / "normalize_fa.py"):
        if not path.is_file():
            continue
        spec = importlib.util.spec_from_file_location("normalize_fa_standalone", path)
        if spec is None or spec.loader is None:
            continue
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module.normalize_for_model

    raise ImportError(
        "normalize_fa.py was not found. Looked for the `training.farsi` package, "
        f"{APP_DIR / 'normalize_fa.py'} and {SRC_DIR / 'training' / 'farsi' / 'normalize_fa.py'}. "
        "Re-run setup.cmd to restore the vendored source tree."
    )


# The two voice prompts shipped with the model card, so the app is usable before
# the user records anything of their own.
BUILTIN_VOICES = {
    "sample_female": f"hf://{MODEL_ID}/samples/prompt_hello.wav",
    "sample_male": f"hf://{MODEL_ID}/samples/prompt_news_paragraph.wav",
}
DEFAULT_VOICE = "sample_female"
