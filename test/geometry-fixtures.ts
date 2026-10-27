import { readFileSync } from "node:fs";
import { buildPage } from "../src/compose.js";
import { parseScene, resolveTimeline } from "../src/compose-scene.js";
import { WORKED_AUDIO, WORKED_CUES, WORKED_SCENE, workedCaptions } from "./compose-fixtures.js";

export function landscapeFixtures() {
  const worked = parseScene(WORKED_SCENE);
  const motion = parseScene(readFileSync(new URL("../themes/default/examples/terminal.html", import.meta.url), "utf8") +
    readFileSync(new URL("../themes/default/examples/pipeline.html", import.meta.url), "utf8").replace('data-beat="pipeline"', 'data-beat="pipeline" data-cue="pipeline"'));
  return {
    worked: buildPage({ lang: "en", scene: worked, timeline: resolveTimeline(worked, WORKED_CUES, WORKED_AUDIO), captions: workedCaptions(), audioDuration: WORKED_AUDIO,
      sources: new Map([["example-survey", { id: "example-survey", title: "Developer Survey", publisher: "Example", url: "https://www.example.org/survey", quote: "46% ...", date: "2025-07-01" }]]) }),
    motion: buildPage({ lang: "en", scene: motion, timeline: resolveTimeline(motion, { tests: 4, ship: 6, pipeline: 8, review: 10 }, 12), captions: workedCaptions(), audioDuration: 12, sources: new Map(), ambient: { tag: "01 · Motion" } }),
  };
}
