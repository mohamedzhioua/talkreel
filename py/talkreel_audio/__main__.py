"""CLI: one JSON object on stdout, errors on stderr with a non-zero exit code."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="talkreel_audio")
    sub = p.add_subparsers(dest="command", required=True)

    t = sub.add_parser("tts", help="synthesize a WAV with Kokoro")
    t.add_argument("--text-file", required=True, type=Path)
    t.add_argument("--voice", required=True)
    t.add_argument("--lang", required=True)
    t.add_argument("--out", required=True, type=Path)
    t.add_argument("--speed", type=float, default=1.0)

    a = sub.add_parser("align", help="word timestamps with faster-whisper")
    a.add_argument("--wav", required=True, type=Path)
    a.add_argument("--lang", required=True)
    a.add_argument("--model", default="small")

    m = sub.add_parser("models", help="report which models are cached")
    m.add_argument("--whisper-model", default="small")
    return p


def run(args: argparse.Namespace) -> dict:
    if args.command == "tts":
        from .tts import synthesize

        text = args.text_file.read_text(encoding="utf-8")
        return synthesize(text, args.voice, args.lang, args.out, args.speed)
    if args.command == "align":
        from .align import transcribe_words

        if not args.wav.is_file():
            raise FileNotFoundError(f"no such WAV: {args.wav}")
        return transcribe_words(args.wav, args.lang, args.model)
    if args.command == "models":
        from .models import report

        return report(args.whisper_model)
    raise ValueError(f"unknown command {args.command}")


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    # Libraries may print to stdout; keep stdout for the one JSON result.
    real_stdout = sys.stdout
    sys.stdout = sys.stderr
    try:
        result = run(args)
    except Exception as e:  # report every failure the same way
        print(f"talkreel_audio {args.command}: {type(e).__name__}: {e}", file=sys.stderr)
        return 1
    finally:
        sys.stdout = real_stdout
    real_stdout.write(json.dumps(result) + "\n")
    real_stdout.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main())
