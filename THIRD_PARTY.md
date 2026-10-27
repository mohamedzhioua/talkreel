# Third-party software

talkreel's own code is MIT-licensed (see `LICENSE`). Your package managers (`npm install`, `uv sync`) install the software below on your machine, and you install FFmpeg yourself. Generated chapter builds copy fonts and browser runtime assets from the installed npm packages for offline rendering. GPL components are never bundled or vendored. This file is a courtesy notice, not legal advice. Check each project's licence for your use.

## Installed by `npm install`

| Package | Licence | Used for |
|---|---|---|
| [hyperframes](https://github.com/heygen-com/hyperframes) | Apache-2.0 | HTML-to-video rendering. Its telemetry is disabled by default by talkreel (`--telemetry` re-enables it) |
| [gsap](https://gsap.com/) | GSAP standard licence (free, including plugins) | Scene animation |
| [mermaid](https://github.com/mermaid-js/mermaid) | MIT | Diagrams |
| [@fontsource/inter](https://github.com/fontsource/font-files), [@fontsource/jetbrains-mono](https://github.com/fontsource/font-files) | SIL Open Font License 1.1 | Fonts copied into each build folder |
| [@fontsource/ibm-plex-sans-arabic (IBM Plex Sans Arabic)](https://github.com/IBM/plex/blob/master/LICENSE.txt) | SIL Open Font License 1.1 | Arabic font, weights 400/600/700 copied into chapter builds |

## Installed by `uv sync --project py`

| Package | Licence | Used for |
|---|---|---|
| [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) | MIT | Local text-to-speech |
| [Kokoro-82M weights](https://huggingface.co/hexgrad/Kokoro-82M) | Apache-2.0 | Voice model; ONNX `kokoro-v1.0.onnx` and `voices-v1.0.bin` from [model-files-v1.0](https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0), pinned by SHA-256 in `py/talkreel_audio/models.py`; no embedded audio watermark |
| [phonemizer](https://github.com/bootphon/phonemizer) and a bundled [espeak-ng](https://github.com/espeak-ng/espeak-ng) (pulled in by kokoro-onnx) | GPL-3.0 | Pronunciation |
| [faster-whisper](https://github.com/SYSTRAN/faster-whisper) | MIT | Word timestamps for captions |

The talkreel CLI talks to the Python audio helper only through a separate process that exchanges JSON. talkreel never ships the GPL-3.0 components; they arrive only through your own `uv sync`.

## Visual references for product blocks

The HyperFrames registry's `device-frame-stage`, `agent-cursor`,
`cursor-zoom-follow` and `cta-close` are visual references for the device chrome,
cursor/click halo and logo–headline–action closing composition in
`themes/default/theme.css`. These CSS ideas were independently implemented in
the existing talkreel theme. No registry JavaScript, timing code or assets are
copied or vendored; Node resolves every motion plan and the local runtime owns
the paused timeline.

## Installed by you

| Tool | Licence | Note |
|---|---|---|
| [FFmpeg](https://ffmpeg.org/legal.html) | LGPL-2.1+ or GPL, depending on the build | On Windows: `winget install Gyan.FFmpeg`. `talkreel doctor` finds it |
| Node.js ≥ 22, [uv](https://github.com/astral-sh/uv), Python 3.11 | Various | Runtimes |
