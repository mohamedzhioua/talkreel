"""Helper JSON shape on a committed ~1 s WAV. Model tests skip when the models are not cached."""

import json
import wave
from pathlib import Path

import pytest

from talkreel_audio import __main__ as cli
from talkreel_audio import models

FIXTURE = Path(__file__).parent / "fixtures" / "hello.wav"

needs_kokoro = pytest.mark.skipif(not all(models.is_present(mf) for mf in models.KOKORO_FILES), reason="Kokoro model files not cached")
needs_whisper = pytest.mark.skipif(not models.whisper_present("small"), reason="faster-whisper small not cached")


def run_cli(argv, capsys):
    code = cli.main(argv)
    out = capsys.readouterr().out.strip().splitlines()
    return code, out


def test_fixture_is_about_one_second():
    with wave.open(str(FIXTURE)) as w:
        seconds = w.getnframes() / w.getframerate()
    assert 0.5 < seconds < 2.0


def test_models_report_shape(capsys):
    code, out = run_cli(["models", "--whisper-model", "small"], capsys)
    assert code == 0 and len(out) == 1
    r = json.loads(out[0])
    assert set(r) == {"cache_dir", "kokoro", "whisper"}
    assert isinstance(r["kokoro"]["present"], bool)
    assert [f["name"] for f in r["kokoro"]["files"]] == ["kokoro-v1.0.onnx", "voices-v1.0.bin"]
    assert r["whisper"]["model"] == "small"


def test_cache_dir_override(monkeypatch, tmp_path):
    monkeypatch.setenv("TALKREEL_CACHE_DIR", str(tmp_path))
    assert models.kokoro_dir() == tmp_path / "kokoro"


def test_errors_go_to_stderr_with_nonzero_exit(capsys, tmp_path):
    code = cli.main(["align", "--wav", str(tmp_path / "missing.wav"), "--lang", "en"])
    captured = capsys.readouterr()
    assert code == 1
    assert captured.out == ""
    assert "missing.wav" in captured.err


@needs_kokoro
def test_tts_json_shape(capsys, tmp_path):
    text = tmp_path / "t.txt"
    text.write_text("Hello world.\n", encoding="utf-8")
    out_wav = tmp_path / "o.wav"
    code, out = run_cli(["tts", "--text-file", str(text), "--voice", "af_heart", "--lang", "en", "--out", str(out_wav)], capsys)
    assert code == 0 and len(out) == 1
    r = json.loads(out[0])
    assert set(r) == {"duration", "sample_rate"}
    assert r["sample_rate"] == 24000
    assert 0.3 < r["duration"] < 3.0
    with wave.open(str(out_wav)) as w:
        assert (w.getnchannels(), w.getsampwidth(), w.getframerate()) == (1, 2, 24000)


@needs_whisper
def test_align_json_shape(capsys):
    code, out = run_cli(["align", "--wav", str(FIXTURE), "--lang", "en", "--model", "small"], capsys)
    assert code == 0 and len(out) == 1
    r = json.loads(out[0])
    assert r["lang"] == "en" and r["model"] == "small"
    assert r["duration"] > 0
    assert r["words"], "expected at least one word"
    for w in r["words"]:
        assert set(w) == {"word", "start", "end", "prob"}
        assert isinstance(w["word"], str) and w["word"]
        assert 0 <= w["start"] <= w["end"] <= r["duration"] + 0.5
    assert "hello" in " ".join(w["word"] for w in r["words"]).lower()
