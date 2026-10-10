"""Persian (Farsi) text-to-speech with voice cloning, running on a CPU.

Built on `mehdi-hf/pocket-tts-farsi-v2` (109.5M parameters) and the
`mehdi-hf/Homo-GE2PE-Persian-HF` grapheme-to-phoneme frontend.

    from farsi_tts import FarsiTTS

    tts = FarsiTTS()
    result = tts.synthesize("سلام، حال شما چطور است؟", voice="my_voice")
    print(result.seconds, result.phonemes)
"""

from . import paths  # noqa: F401  (import-time env/path wiring, must stay first)
from .audio_io import read_audio, write_wav, wav_bytes
from .engine import FarsiTTS, Settings, SynthResult, get_engine

__all__ = [
    "FarsiTTS",
    "Settings",
    "SynthResult",
    "get_engine",
    "read_audio",
    "write_wav",
    "wav_bytes",
    "paths",
]

__version__ = "1.0.0"
