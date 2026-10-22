"""Kokoro TTS (kokoro-onnx). Writes a 16-bit PCM mono WAV with the stdlib ``wave`` module."""

from __future__ import annotations

import sys
import wave
from pathlib import Path

import numpy as np

from . import models

# talk.json language -> espeak-ng language for Kokoro's phonemizer.
LANGS = {"en": "en-us", "fr": "fr-fr"}
PARAGRAPH_PAUSE_S = 0.35


def split_paragraphs(text: str) -> list[str]:
    return [" ".join(p.split()) for p in text.replace("\r\n", "\n").split("\n\n") if p.strip()]


def write_wav(path: Path, samples: np.ndarray, sample_rate: int) -> None:
    pcm = (np.clip(samples, -1.0, 1.0) * 32767.0).astype("<i2")
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(pcm.tobytes())


def synthesize(text: str, voice: str, lang: str, out: Path, speed: float = 1.0) -> dict:
    if lang not in LANGS:
        raise ValueError(f"unsupported language {lang!r}; expected one of {sorted(LANGS)}")
    paragraphs = split_paragraphs(text)
    if not paragraphs:
        raise ValueError("no text to synthesize")

    from kokoro_onnx import Kokoro

    model_path, voices_path = models.kokoro_paths()
    kokoro = Kokoro(str(model_path), str(voices_path))
    chunks: list[np.ndarray] = []
    sample_rate = 0
    for i, para in enumerate(paragraphs):
        print(f"tts: paragraph {i + 1}/{len(paragraphs)}", file=sys.stderr, flush=True)
        samples, sample_rate = kokoro.create(para, voice=voice, speed=speed, lang=LANGS[lang])
        if chunks:
            chunks.append(np.zeros(int(PARAGRAPH_PAUSE_S * sample_rate), dtype=np.float32))
        chunks.append(np.asarray(samples, dtype=np.float32))
    audio = np.concatenate(chunks)
    write_wav(out, audio, sample_rate)
    return {"duration": round(len(audio) / sample_rate, 3), "sample_rate": int(sample_rate)}
