# Research landscape, 2026-10-21

These are sourced findings that M2 and M3 build on. "Unverified" means the project's own page did not confirm it. Check licences again before depending on anything here, because they change.

## Feasibility spike (this machine: Windows 11, i7-1165G7, MX450 2 GB, so CPU-only)

| Stage | Tool | Result |
|---|---|---|
| EN TTS | kokoro-onnx 0.6.1, `af_heart` | Pass, RTF 0.60 |
| FR TTS | kokoro-onnx, `ff_siwis` | Pass, RTF 0.63 |
| FR TTS | Piper `fr_FR-siwis-medium` | Pass, RTF 0.09. GPL-3.0; the base voice licence is unverified |
| Captions | faster-whisper `small` int8 | 54/54 words, RTF 0.23 warm |
| Render | HyperFrames 0.8.185 | 1080p30, about 3× realtime |
| Mux | FFmpeg 9.0.2 (winget `Gyan.FFmpeg`) | Pass |

## Engines and licences

| Tool | Licence | Note | Source |
|---|---|---|---|
| HyperFrames | Apache-2.0 | Seek-based deterministic render; WebGL/Three.js adapter; 14 shader transitions; telemetry on by default | https://github.com/heygen-com/hyperframes |
| HyperFrames community skills | Apache-2.0 | 8 skills incl. `vox-explainer` | https://github.com/heygen-com/hyperframes-community-skills |
| Remotion | Paid company licence for companies with more than 3 employees | Rejected for a free tool | https://github.com/remotion-dev/remotion/blob/main/LICENSE.md |
| GSAP | Free, incl. SplitText (MorphSVG/DrawSVG reported free) | Install from npm; don't redistribute | https://gsap.com/pricing/ |
| Kokoro-82M | Apache-2.0 weights | kokoro-onnx is MIT but pulls GPL-3.0 `phonemizer` + espeak-ng | https://huggingface.co/hexgrad/Kokoro-82M |
| faster-whisper | MIT | Word timestamps | https://github.com/SYSTRAN/faster-whisper |
| gl-transitions | MIT (two BSD) | Shader transitions | https://github.com/gl-transitions/gl-transitions |

## Voice cloning (M2)

Recommended: **Chatterbox Multilingual** (MIT, French, Perth watermark; CPU speed unverified). Fallbacks: NeuTTS Air (Apache-2.0 weights, CPU via llama.cpp) and OpenVoice v2 (MIT).

Avoid, because the weights or code are non-commercial or restricted: F5-TTS, XTTS-v2, MaskGCT, Higgs Audio v3, IndexTTS2, Fish Speech (revenue cap).

Sources: https://github.com/resemble-ai/chatterbox · https://github.com/neuphonic/neutts · https://github.com/myshell-ai/OpenVoice

## Photo + voice presenter (M3)

- No permissively licensed model gives a full 10-minute talking head with head motion on free hardware in reasonable time.
- StableAvatar takes about 3 minutes per 5 s of video on an RTX 4090, which works out to about 6 hours for 10 minutes.
- **Lips only, full length:** MuseTalk 1.5 (MIT code and weights; about 4 GB VRAM fp16) on a free Kaggle T4, over a looped idle clip, shown as a picture-in-picture circle. T4 speed is unverified. https://github.com/TMElyralab/MuseTalk
- **Head motion, short segments** (intro, chapter openers, outro): EchoMimic V3 Flash (Apache-2.0, 12 GB) or StableAvatar (MIT). https://github.com/antgroup/echomimic_v3 · https://github.com/Francis-Rings/StableAvatar
- **Avoid:** Wav2Lip and Sonic (non-commercial), V-Express (non-commercial models). Also avoid anything bundling InsightFace models (non-commercial), including LivePortrait, JoyVASA and Ditto.
- **Compute:**
  - Kaggle: about 30 GPU-h/week, unverified.
  - HF ZeroGPU: 5 min/day free.
  - Google Colab's FAQ prohibits "creating deepfakes", so don't use it. https://research.google.com/colaboratory/faq.html
- **Safeguards:**
  - EU AI Act Art. 50 transparency applies from 2026-08-02. https://artificialintelligenceact.eu/article/50/
  - Plan: a self-only consent attestation, a visible "AI-generated presenter" badge, voice watermark left on, and C2PA where feasible.

## Cinematic upgrades (M2), ranked by value for the effort

1. A virtual camera (push-in, pan, zoom into a diagram node) using a GSAP wrapper.
2. Mermaid → SVG, with edges that draw themselves and nodes that appear in sequence.
3. Kinetic typography timed to the word timestamps (SplitText).
4. An FFmpeg finishing pass:
   - `sidechaincompress` ducking and `loudnorm` to -16 LUFS
   - grain, vignette and a hand-written grade
5. Shader transitions plus CC0 whooshes. CPU WebGL speed is unverified, so measure it first.
6. Storytelling structure: a cold open, chapter cards, a recurring motif and a call-back ending.

**Audio sources:**
- Freesound: CC0 only.
- Kevin MacLeod: CC-BY 4.0.
- Pixabay: never commit the raw files.
- ACE-Step 1.5 (MIT) generates music locally.
- Avoid MusicGen (CC-BY-NC).

Image-to-video B-roll (Wan 2.x) is infeasible on 2 GB VRAM.

## Prior art and positioning

Projects found:
- MoneyPrinterTurbo (134k stars): short clips from stock footage.
- Paper2Video and Code2Video: research-paper and topic videos.
- HyperFrames `pr-to-video`: videos of PRs and diffs only.

Nothing found makes a long-form, chaptered, bilingual, self-reviewing explainer from a repo or docs with a free, local stack. That gap is talkreel's niche.

`promo-flow` (https://github.com/MedAdemBHA/promo-flow) has no licence, so we take ideas from it (stage resume, voice-over-driven timing, chapter sub-compositions), never code.
