import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SLUG_RE, type SourcesFile, type TalkConfig } from "../schema.js";

const REEL_SCRIPT = `# Your reel

<!-- Hook: replace this with the problem and promise, in your own words. -->
Still doing this the hard way? Here is a simpler way to get started.

<!-- Proof: add your own photo at assets/proof.jpg and logo at assets/logo.svg. -->
{#proof}Show the result with a clear photo of your work.
{#benefits}Keep the next steps simple. {#first}Show what matters.
{#second}Make the benefit easy to understand. {#third}Give the viewer a clear next step.

<!-- CTA: leave enough narration to hold the fully entered card for 1.5 seconds. -->
{#cta}Ready to try it? Visit our site and take the first step today.
`;

const REEL_SCENE = `<section data-beat="hook" data-camera="push-in">
  <div data-block="title" data-variant="hook">
    <h1>Still doing this <em>the hard way?</em></h1>
  </div>
</section>

<section data-beat="proof" data-cue="proof">
  <figure data-block="figure">
    <!-- Add your own photo at assets/proof.jpg before running check. -->
    <img src="assets/proof.jpg" alt="The result of your work">
    <figcaption>Show the result</figcaption>
  </figure>
</section>

<section data-beat="benefits" data-cue="benefits">
  <div data-block="list">
    <ul>
      <li data-cue="first">Show what matters</li>
      <li data-cue="second">Make the benefit clear</li>
      <li data-cue="third">Give one next step</li>
    </ul>
  </div>
</section>

<section data-beat="cta" data-cue="cta">
  <div data-block="cta">
    <!-- Add your own standalone logo at assets/logo.svg before running check. -->
    <img src="assets/logo.svg" alt="Your product logo">
    <h2>Ready to try it?</h2>
    <p class="action">Take the first step today</p>
    <p class="url">example.org</p>
  </div>
</section>
`;

export function defaultTalkConfig(slug: string, title: string): TalkConfig {
  return {
    slug,
    title,
    languages: ["en"],
    voice: { mode: "ai", en: "af_heart", fr: "ff_siwis" },
    theme: "default",
    fps: 30,
    resolution: "landscape",
  };
}

/** Create talks/<slug>/ under `root` with talk.json, sources.json, script/en/ and scenes/. */
export function cmdNew(root: string, slug: string | undefined, title: string | undefined, reel = false): number {
  if (!slug || !SLUG_RE.test(slug)) {
    console.error(`usage: talkreel new <slug> --title "<title>" [--reel]   (slug must match ${SLUG_RE.source})`);
    return 1;
  }
  if (!title || !title.trim()) {
    console.error('missing --title "<title>"');
    return 1;
  }
  const dir = resolve(root, "talks", slug);
  if (existsSync(dir)) {
    console.error(`${dir} already exists`);
    return 1;
  }
  mkdirSync(join(dir, "script", "en"), { recursive: true });
  mkdirSync(join(dir, "scenes"), { recursive: true });
  const config = defaultTalkConfig(slug, title.trim());
  if (reel) {
    config.resolution = "portrait";
    mkdirSync(join(dir, "assets"), { recursive: true });
    writeFileSync(join(dir, "script", "en", "01-reel.md"), REEL_SCRIPT, "utf8");
    writeFileSync(join(dir, "scenes", "01-reel.html"), REEL_SCENE, "utf8");
  }
  writeFileSync(join(dir, "talk.json"), JSON.stringify(config, null, 2) + "\n", "utf8");
  const sources: SourcesFile = { sources: [] };
  writeFileSync(join(dir, "sources.json"), JSON.stringify(sources, null, 2) + "\n", "utf8");
  console.log(`created ${dir}`);
  return 0;
}
