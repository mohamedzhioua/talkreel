"""Script alignment with explicit, revision-pinned Arabic CTC weights.

Heavy imports stay inside the alignment call; text and frame handling need no torch.
"""

from __future__ import annotations

import re
import unicodedata
import wave
from pathlib import Path

MODEL_ID = "jonatasgrosman/wav2vec2-large-xlsr-53-arabic"
MODEL_REVISION = "af46c2d8531b8dcbb5e23b952f739b372c2e5d2d"
MODEL = f"ctc:{MODEL_REVISION}"
MODEL_FILES = (
    "config.json", "preprocessor_config.json", "pytorch_model.bin",
    "special_tokens_map.json", "vocab.json",
)
HARAKAT = re.compile(r"[\u064b-\u065f\u0670]")


def prepare_text(text: str) -> str:
    """NFC first preserves composed hamza/madda letters when stripping tashkeel."""
    return HARAKAT.sub("", unicodedata.normalize("NFC", text)).replace("\u0640", "")


def alignment_words(text: str) -> list[str]:
    words = []
    for raw in prepare_text(text).split():
        # Digit-containing tokens cannot be scored by this model. Leave their
        # whole script token to align-map's interpolation, including e.g. ٩٠٪.
        if any(c.isdecimal() for c in raw):
            continue
        word = "".join(c for c in raw if unicodedata.category(c)[0] not in "PS")
        if word:
            words.append(word)
    return words


def model_snapshot(*, local_files_only: bool = False) -> Path:
    from huggingface_hub import snapshot_download

    path = Path(snapshot_download(
        repo_id=MODEL_ID, revision=MODEL_REVISION,
        allow_patterns=list(MODEL_FILES), local_files_only=local_files_only,
    ))
    if not path.is_dir() or not all((path / name).is_file() for name in MODEL_FILES):
        raise RuntimeError(f"incomplete pinned Arabic CTC snapshot: {path}")
    return path


def timed_words(texts: list[str], spans: list, blank: str, stride_ms: float) -> list[dict]:
    """Use inclusive segment frame ends, excluding the library's blank padding."""
    words = []
    for text, span in zip(texts, spans, strict=True):
        if text == "<star>":
            continue
        speech = [seg for seg in span if seg.label != blank]
        if not speech:
            raise RuntimeError(f"no non-blank frames for {text!r}")
        words.append({
            "word": text,
            "start": round(speech[0].start * stride_ms / 1000, 3),
            "end": round((speech[-1].end + 1) * stride_ms / 1000, 3),
        })
    return words


def align_script(wav: Path, text: str, lang: str = "ar") -> dict:
    if lang != "ar":
        raise ValueError("CTC alignment supports only ar")
    with wave.open(str(wav)) as audio_file:
        duration = audio_file.getnframes() / audio_file.getframerate()
    words = alignment_words(text)
    if not words:
        return {"lang": lang, "model": MODEL, "duration": round(duration, 3), "words": []}

    import torch
    from ctc_forced_aligner import (
        generate_emissions, get_alignments, get_spans, load_alignment_model,
        load_audio, preprocess_text,
    )

    # No default model call or fallback: resolve the exact revision before loading.
    snapshot = model_snapshot()
    model, tokenizer = load_alignment_model("cpu", model_path=str(snapshot), dtype=torch.float32)
    tokens, texts = preprocess_text(" ".join(words), romanize=False, language="ara")
    vocab = tokenizer.get_vocab()
    unknown = sorted({c for token in tokens if token != "<star>" for c in token.split() if c not in vocab})
    if unknown:
        raise ValueError(f"characters outside the Arabic CTC vocabulary: {unknown}")
    audio = load_audio(str(wav), model.dtype, model.device)
    emissions, stride = generate_emissions(model, audio, batch_size=1)
    segments, _scores, blank = get_alignments(emissions, tokens, tokenizer)
    spans = get_spans(tokens, segments, blank)
    return {
        "lang": lang, "model": MODEL, "duration": round(duration, 3),
        "words": timed_words(texts, spans, blank, stride),
    }
