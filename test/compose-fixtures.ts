// Fixtures shared by the composer tests: the worked example of scenes.md section 11.
import { writeFileSync } from "node:fs";
import { parseScript } from "../src/script.js";
import type { CaptionsFile } from "../src/schema.js";

export const WORKED_SCRIPT = `# Verification beats vibes

An assistant can draft a feature in minutes. {#doubt}But who checks it?
{#stat}In one survey, 46% of developers said they distrust the accuracy of AI
tools. [s:example-survey] {#loop}So I work in a loop. {#spec}Write the spec,
{#tests}run the tests, {#review}and let a fresh model review the diff.
`;

export const WORKED_SCENE = `<section data-beat="open" data-camera="push-in">
  <div data-block="chapter-card" data-anim="pop">
    <p class="number">02</p>
    <h2 class="title">Verification beats vibes</h2>
  </div>
  <p data-cue="doubt">But who checks it?</p>
</section>

<section data-beat="stat" data-cue="stat">
  <div data-block="stat" data-source="s:example-survey">
    <p class="value">46%</p>
    <p class="label">of developers distrust the accuracy of AI tools</p>
  </div>
</section>

<section data-beat="loop" data-cue="loop">
  <figure data-block="diagram">
    <pre data-mermaid>flowchart LR
  S[Spec] --> T[Tests]
  T --> R[Review]
  R -->|next slice| S</pre>
    <i data-step data-nodes="S" data-cue="spec"></i>
    <i data-step data-nodes="T" data-edges="S-T" data-cue="tests"></i>
    <i data-step data-nodes="R" data-edges="T-R,R-S" data-cue="review"></i>
    <figcaption>One slice at a time</figcaption>
  </figure>
</section>
`;

export const WORKED_AUDIO = 19.7;

/** Captions for the worked example: given cue-word starts, the rest evenly spaced. */
export function workedCaptions(): CaptionsFile {
  const ch = parseScript(WORKED_SCRIPT);
  const fixed: Record<number, number> = { 8: 3.62, 12: 5.66, 26: 11.5, 32: 14.12, 35: 15.4, 38: 16.64 };
  const anchors = [[0, 0.1], ...Object.entries(fixed).map(([k, v]) => [Number(k), v]), [ch.words.length, 19.5]] as [number, number][];
  const starts: number[] = [];
  for (let a = 0; a < anchors.length - 1; a++) {
    const [k0, t0] = anchors[a]!;
    const [k1, t1] = anchors[a + 1]!;
    for (let k = k0; k < k1; k++) starts[k] = t0 + ((t1 - t0) * (k - k0)) / (k1 - k0);
  }
  return {
    lang: "en",
    words: ch.words.map((text, k) => ({ text, start: Math.round(starts[k]! * 1000) / 1000, end: Math.round(((starts[k + 1] ?? 19.6) - 0.02) * 1000) / 1000, matched: true })),
  };
}

export const WORKED_CUES = { doubt: 3.62, stat: 5.66, loop: 11.5, spec: 14.12, tests: 15.4, review: 16.64 };

/** A silent 16-bit mono PCM WAV of `seconds` length. */
export function writeWav(file: string, seconds: number, rate = 24000): void {
  const samples = Math.round(seconds * rate);
  const b = Buffer.alloc(44 + samples * 2);
  b.write("RIFF", 0, "ascii");
  b.writeUInt32LE(36 + samples * 2, 4);
  b.write("WAVE", 8, "ascii");
  b.write("fmt ", 12, "ascii");
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36, "ascii");
  b.writeUInt32LE(samples * 2, 40);
  writeFileSync(file, b);
}
