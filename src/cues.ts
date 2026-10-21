// Resolve {#cue-name} markers to times, for the composer.
import { cueWordIndex, type ParsedChapter } from "./script.js";
import type { CaptionsFile } from "./schema.js";

/**
 * Map each cue name to the start time (seconds) of the word that follows its marker.
 * Captions have one word per script word, so a cue's word index points straight into them.
 */
export function resolveCues(chapter: ParsedChapter, captions: CaptionsFile): Record<string, number> {
  if (captions.words.length !== chapter.words.length) {
    throw new Error(`captions have ${captions.words.length} words but the script has ${chapter.words.length}; re-run "talkreel align"`);
  }
  const out: Record<string, number> = {};
  for (const cue of chapter.cues) out[cue.id] = captions.words.length ? captions.words[cueWordIndex(chapter, cue)]!.start : 0;
  return out;
}
