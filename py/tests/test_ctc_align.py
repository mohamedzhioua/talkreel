"""CTC preparation and adapter tests run without the optional torch environment."""

import json
import os
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

from talkreel_audio import __main__ as cli
from talkreel_audio import ctc_align as ctc
from talkreel_audio import models

FIXTURE = Path(__file__).parent / "fixtures" / "hello.wav"


def test_text_prep_preserves_hamza_and_madda_after_nfc():
    assert ctc.prepare_text("أَ إِ آ ؤ ئ ا\u0654 ا\u0655 ا\u0653 سـلَامٌ هٰذا") == "أ إ آ ؤ ئ أ إ آ سلام هذا"
    assert ctc.prepare_text("س" + "".join(chr(c) for c in range(0x064B, 0x0660)) + "\u0670") == "س"
    assert ctc.prepare_text("س\u06d6") == "س\u06d6"  # not a general combining-mark strip


@pytest.mark.parametrize("digits", ["90", "٩٠", "۹۰", "٩٠٪", "(90%)", "3.5", "عام2026"])
def test_digit_tokens_are_omitted_whole(digits):
    assert ctc.alignment_words(f"هَذا، {digits} جَيِّدٌ.") == ["هذا", "جيد"]


def test_every_word_ends_after_its_last_nonblank_frame():
    seg = lambda label, start, end: SimpleNamespace(label=label, start=start, end=end)
    spans = [
        [seg("<star>", 0, 4)],
        [seg("blank", 4, 6), seg("ه", 7, 7), seg("blank", 8, 9), seg("ا", 10, 12), seg("blank", 12, 20)],
        [seg("blank", 20, 22), seg("ن", 23, 23), seg("blank", 23, 99)],
    ]
    assert ctc.timed_words(["<star>", "ها", "ن"], spans, "blank", 20) == [
        {"word": "ها", "start": 0.14, "end": 0.26},
        {"word": "ن", "start": 0.46, "end": 0.48},
    ]
    with pytest.raises(RuntimeError, match="no non-blank"):
        ctc.timed_words(["ها"], [[seg("blank", 0, 10)]], "blank", 20)


def test_cli_requires_paths_and_arabic():
    args = cli.build_parser().parse_args(["ctc-align", "--wav", "a.wav", "--text-file", "t.txt", "--lang", "ar"])
    assert (args.command, args.wav, args.text_file, args.lang) == ("ctc-align", Path("a.wav"), Path("t.txt"), "ar")
    for argv in (["ctc-align"], ["ctc-align", "--wav", "a.wav", "--text-file", "t.txt", "--lang", "en"]):
        with pytest.raises(SystemExit):
            cli.build_parser().parse_args(argv)


def test_cli_reads_utf8_text_and_returns_json(monkeypatch, tmp_path, capsys):
    text_file = tmp_path / "script.txt"
    text_file.write_text("أَهْلًا", encoding="utf-8")

    def align(wav, text, lang):
        assert (wav, text, lang) == (FIXTURE, "أَهْلًا", "ar")
        return {"lang": lang, "model": ctc.MODEL, "duration": 1, "words": [{"word": "أهلا", "start": 0, "end": 0.4}]}

    monkeypatch.setattr(ctc, "align_script", align)
    assert cli.main(["ctc-align", "--wav", str(FIXTURE), "--text-file", str(text_file), "--lang", "ar"]) == 0
    captured = capsys.readouterr()
    assert captured.err == ""
    assert json.loads(captured.out)["words"][0]["word"] == "أهلا"


def test_stdout_is_utf8_even_in_isolated_python():
    # Start with a cp1252 stdout as on Windows. -I ignores PYTHONIOENCODING.
    script = (
        f"import sys; sys.path.insert(0, {str(FIXTURE.parents[2])!r}); "
        "sys.stdout.reconfigure(encoding='cp1252'); "
        "from talkreel_audio import __main__ as cli; "
        "cli.run = lambda args: {'word': '\\u0623\\u0647\\u0644\\u0627'}; "
        "sys.exit(cli.main(['models']))"
    )
    result = subprocess.run([sys.executable, "-I", "-c", script], capture_output=True)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout.decode("utf-8")) == {"word": "أهلا"}


def test_snapshot_is_explicit_pinned_and_complete(monkeypatch, tmp_path):
    calls = []

    def download(**kwargs):
        calls.append(kwargs)
        return str(tmp_path)

    monkeypatch.setitem(sys.modules, "huggingface_hub", SimpleNamespace(snapshot_download=download))
    with pytest.raises(RuntimeError, match="incomplete pinned"):
        ctc.model_snapshot()
    for name in ctc.MODEL_FILES:
        (tmp_path / name).touch()
    assert ctc.model_snapshot(local_files_only=True) == tmp_path
    assert calls == [
        dict(repo_id=ctc.MODEL_ID, revision=ctc.MODEL_REVISION, allow_patterns=list(ctc.MODEL_FILES), local_files_only=local)
        for local in (False, True)
    ]


def test_adapter_passes_local_model_and_never_falls_back(monkeypatch, tmp_path):
    calls = []
    monkeypatch.setattr(ctc, "model_snapshot", lambda: tmp_path)
    monkeypatch.setitem(sys.modules, "torch", SimpleNamespace(float32="float32"))

    def load(device, **kwargs):
        calls.append((device, kwargs))
        raise RuntimeError("pinned weights cannot load")

    monkeypatch.setitem(sys.modules, "ctc_forced_aligner", SimpleNamespace(
        load_alignment_model=load, generate_emissions=None, get_alignments=None,
        get_spans=None, load_audio=None, preprocess_text=None,
    ))
    with pytest.raises(RuntimeError, match="pinned weights cannot load"):
        ctc.align_script(FIXTURE, "هذا")
    assert calls == [("cpu", {"model_path": str(tmp_path), "dtype": "float32"})]


def test_adapter_aligns_clean_script_without_romanization(monkeypatch, tmp_path):
    monkeypatch.setattr(ctc, "model_snapshot", lambda: tmp_path)
    monkeypatch.setitem(sys.modules, "torch", SimpleNamespace(float32="float32"))
    model = SimpleNamespace(dtype="float32", device="cpu")
    tokenizer = SimpleNamespace(get_vocab=lambda: {"ه": 1, "ذ": 2, "ا": 3})
    segment = SimpleNamespace(label="ا", start=5, end=10)

    def load(device, *, model_path, dtype):
        assert (device, model_path, dtype) == ("cpu", str(tmp_path), "float32")
        return model, tokenizer

    def preprocess(text, *, romanize, language):
        assert (text, romanize, language) == ("هذا", False, "ara")
        return ["<star>", "ه ذ ا"], ["<star>", "هذا"]

    monkeypatch.setitem(sys.modules, "ctc_forced_aligner", SimpleNamespace(
        load_alignment_model=load,
        generate_emissions=lambda model, audio, batch_size: ("emissions", 20),
        get_alignments=lambda emissions, tokens, tokenizer: ([segment], None, "blank"),
        get_spans=lambda tokens, segments, blank: [[segment], [segment]],
        load_audio=lambda path, dtype, device: "audio", preprocess_text=preprocess,
    ))
    result = ctc.align_script(FIXTURE, "هَذا، ٩٠٪ 90")
    assert result["model"] == ctc.MODEL and result["lang"] == "ar"
    assert result["words"] == [{"word": "هذا", "start": 0.1, "end": 0.22}]


def test_optional_report_only_probes_local_cache(monkeypatch):
    monkeypatch.setattr(models.importlib.util, "find_spec", lambda name: None)

    def missing(*, local_files_only):
        assert local_files_only is True
        raise FileNotFoundError("uncached")

    monkeypatch.setattr(ctc, "model_snapshot", missing)
    assert models.ctc_report() == {
        "available": False, "present": False, "model": ctc.MODEL_ID, "revision": ctc.MODEL_REVISION,
    }


@pytest.mark.parametrize("recorded", [False, True], ids=["slice0-sample", "recorded-narration"])
def test_cached_ctc_alignment(recorded):
    availability = models.ctc_report()
    if not availability["available"] or not availability["present"]:
        pytest.skip("optional Arabic group or pinned CTC model snapshot absent")
    if recorded:
        wav = os.environ.get("TALKREEL_CTC_TEST_WAV")
        text_file = os.environ.get("TALKREEL_CTC_TEST_TEXT")
        if not wav or not text_file:
            pytest.skip("set TALKREEL_CTC_TEST_WAV and TALKREEL_CTC_TEST_TEXT for recorded narration")
        wav = Path(wav)
        text = Path(text_file).read_text(encoding="utf-8")
    else:
        wav = Path(__file__).resolve().parents[2] / ".spike/m3-s0/samples/chatterbox-ar-1.wav"
        if not wav.is_file():
            pytest.skip("slice-0 audio sample absent")
        text = "هذا تولكريل، يحول النص حقك إلى فيديو كامل في دقايق."
    result = ctc.align_script(wav, text)
    assert set(result) == {"lang", "model", "duration", "words"}
    assert result["lang"] == "ar" and result["model"] == ctc.MODEL
    assert [w["word"] for w in result["words"]] == ctc.alignment_words(text)
    assert all(0 <= w["start"] <= w["end"] <= result["duration"] for w in result["words"])
    if not recorded:
        assert result["words"][-1]["end"] < result["duration"] - 0.2
