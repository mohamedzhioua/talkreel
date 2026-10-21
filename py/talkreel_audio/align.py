"""Word timestamps with faster-whisper (CPU, int8)."""

from __future__ import annotations

from pathlib import Path


def transcribe_words(wav: Path, lang: str, model: str = "small") -> dict:
    from faster_whisper import WhisperModel

    whisper = WhisperModel(model, device="cpu", compute_type="int8")
    segments, info = whisper.transcribe(str(wav), language=lang, word_timestamps=True, beam_size=5)
    words = []
    for seg in segments:  # a generator: transcription runs while iterating
        for w in seg.words or []:
            text = w.word.strip()
            if not text:
                continue
            words.append(
                {
                    "word": text,
                    "start": round(float(w.start), 3),
                    "end": round(float(w.end), 3),
                    "prob": round(float(w.probability), 3),
                }
            )
    return {"lang": lang, "model": model, "duration": round(float(info.duration), 3), "words": words}
