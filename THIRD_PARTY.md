# Third-party software

talkreel's own code is MIT-licensed (see `LICENSE`). talkreel does not bundle, vendor or redistribute any of the software below. Your package managers (`npm install`, `uv sync`) install it on your machine, and you install FFmpeg yourself. This file is a courtesy notice, not legal advice. Check each project's licence for your use.

## Installed by `npm install`

| Package | Licence | Used for |
|---|---|---|
| [hyperframes](https://github.com/heygen-com/hyperframes) | Apache-2.0 | HTML-to-video rendering. Its telemetry is disabled by default by talkreel (`--telemetry` re-enables it) |
| [gsap](https://gsap.com/) | GSAP standard licence (free, including plugins) | Scene animation |
| [mermaid](https://github.com/mermaid-js/mermaid) | MIT | Diagrams |
| [@fontsource/inter](https://github.com/fontsource/font-files), [@fontsource/jetbrains-mono](https://github.com/fontsource/font-files) | SIL Open Font License 1.1 | Fonts copied into each build folder |

## Installed by `uv sync --project py`

| Package | Licence | Used for |
|---|---|---|
| [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) | MIT | Local text-to-speech |
| [Kokoro-82M weights](https://huggingface.co/hexgrad/Kokoro-82M) | Apache-2.0 | Voice model, downloaded on first use |
| [phonemizer](https://github.com/bootphon/phonemizer) and a bundled [espeak-ng](https://github.com/espeak-ng/espeak-ng) (pulled in by kokoro-onnx) | GPL-3.0 | Pronunciation |
| [faster-whisper](https://github.com/SYSTRAN/faster-whisper) | MIT | Word timestamps for captions |

The talkreel CLI talks to the Python audio helper only through a separate process that exchanges JSON. talkreel never ships the GPL-3.0 components; they arrive only through your own `uv sync`.

## Installed by you

| Tool | Licence | Note |
|---|---|---|
| [FFmpeg](https://ffmpeg.org/legal.html) | LGPL-2.1+ or GPL, depending on the build | On Windows: `winget install Gyan.FFmpeg`. `talkreel doctor` finds it |
| Node.js ≥ 22, [uv](https://github.com/astral-sh/uv), Python 3.11 | Various | Runtimes |
