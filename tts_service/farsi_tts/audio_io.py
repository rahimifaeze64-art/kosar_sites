"""Audio file helpers: read anything, write 16-bit WAV, trim silence.

Kept deliberately small and dependency-light. ``soundfile`` handles mp3 / ogg /
flac as well as WAV; plain WAV falls back to the standard library so the app
still works if the soundfile wheel is unavailable.
"""

from __future__ import annotations

import wave
from pathlib import Path

import numpy as np


def read_audio(path: str | Path) -> tuple[np.ndarray, int]:
    """Read an audio file into mono float32 in [-1, 1]. Returns (samples, rate)."""
    path = Path(path)
    if not path.is_file():
        raise FileNotFoundError(f"audio file not found: {path}")

    try:
        import soundfile as sf

        data, rate = sf.read(str(path), dtype="float32", always_2d=True)
        return data.mean(axis=1).astype(np.float32), int(rate)
    except ImportError:
        pass
    except Exception as exc:  # unsupported/corrupt container
        raise ValueError(f"could not read {path.name}: {exc}") from exc

    with wave.open(str(path), "rb") as handle:
        channels = handle.getnchannels()
        width = handle.getsampwidth()
        rate = handle.getframerate()
        frames = handle.readframes(handle.getnframes())
    if width != 2:
        raise ValueError(f"{path.name}: only 16-bit WAV can be read without soundfile")
    samples = np.frombuffer(frames, dtype="<i2").astype(np.float32) / 32768.0
    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1)
    return samples, rate


def write_wav(path: str | Path, samples: np.ndarray, sample_rate: int) -> Path:
    """Write mono float32 audio as a 16-bit PCM WAV."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    data = np.asarray(samples, dtype=np.float32).reshape(-1)
    peak = float(np.max(np.abs(data))) if data.size else 0.0
    if peak > 1.0:  # never hard-clip into the encoder
        data = data / peak
    pcm = np.clip(data * 32767.0, -32768.0, 32767.0).astype("<i2")
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(int(sample_rate))
        handle.writeframes(pcm.tobytes())
    return path


def wav_bytes(samples: np.ndarray, sample_rate: int) -> bytes:
    """Same as `write_wav` but returns the WAV file as bytes (for HTTP replies)."""
    import io
    import wave as _wave

    data = np.asarray(samples, dtype=np.float32).reshape(-1)
    peak = float(np.max(np.abs(data))) if data.size else 0.0
    if peak > 1.0:
        data = data / peak
    pcm = np.clip(data * 32767.0, -32768.0, 32767.0).astype("<i2")
    buffer = io.BytesIO()
    with _wave.open(buffer, "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(int(sample_rate))
        handle.writeframes(pcm.tobytes())
    return buffer.getvalue()


def resample_linear(samples: np.ndarray, src_rate: int, dst_rate: int) -> np.ndarray:
    """Cheap linear resample. Only used for measuring/trimming, never for output."""
    if src_rate == dst_rate or samples.size == 0:
        return np.asarray(samples, dtype=np.float32)
    out_len = int(round(samples.size * dst_rate / src_rate))
    if out_len <= 0:
        return np.zeros(0, dtype=np.float32)
    src_idx = np.linspace(0.0, samples.size - 1, out_len)
    return np.interp(src_idx, np.arange(samples.size), samples).astype(np.float32)


def trim_silence(samples: np.ndarray, sample_rate: int, margin_ms: float = 120.0
                 ) -> np.ndarray:
    """Cut leading/trailing silence, keeping `margin_ms` of it on each side.

    The threshold is deliberately low and the margin generous: a voiced stop
    such as the /b/ of "bebarad" is brief and quiet, and clipping an onset
    trades one artefact for a worse one.
    """
    audio = np.asarray(samples, dtype=np.float32).reshape(-1)
    if audio.size == 0:
        return audio
    rms = float(np.sqrt((audio.astype(np.float64) ** 2).mean()))
    if rms <= 0:
        return audio
    window = max(int(0.02 * sample_rate), 1)
    threshold = 0.04 * rms
    loud = [
        i for i in range(0, max(audio.size - window, 1), window)
        if np.sqrt((audio[i:i + window].astype(np.float64) ** 2).mean()) > threshold
    ]
    if not loud:
        return audio
    margin = int(margin_ms / 1000.0 * sample_rate)
    start = max(0, loud[0] - margin)
    end = min(audio.size, loud[-1] + window + margin)
    return audio[start:end]


def peak_normalise(samples: np.ndarray, target: float = 0.95) -> np.ndarray:
    audio = np.asarray(samples, dtype=np.float32).reshape(-1)
    peak = float(np.max(np.abs(audio))) if audio.size else 0.0
    if peak <= 0:
        return audio
    return (audio * (target / peak)).astype(np.float32)
