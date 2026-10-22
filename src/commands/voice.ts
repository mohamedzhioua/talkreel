import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";
import * as helper from "../audio-helper.js";
import { toCanonicalWav } from "../ffmpeg.js";
import { parseScriptFile } from "../script.js";
import { currentVoiceHash, voiceId, voiceOutputs } from "../stages.js";
import { chapterKey, readState, recordStage, stageStatus, writeState } from "../state.js";
import { paths, selectChapters, type Talk } from "../talk.js";

export async function cmdVoice(talk: Talk, lang: string, chapter?: string): Promise<number> {
  const chapters = selectChapters(talk, lang, chapter);
  if (!chapters.length) {
    console.error(`no chapters in script/${lang}/`);
    return 1;
  }
  const stateFile = paths.state(talk);
  const state = readState(stateFile);
  const own = talk.config.voice.mode === "own";
  let failed = 0;
  for (const ch of chapters) {
    const key = chapterKey(lang, ch.chapter);
    const src = paths.sourceWav(talk, lang, ch.chapter);
    const canonical = paths.narrationWav(talk, lang, ch.chapter);
    try {
      const parsed = parseScriptFile(ch.file);
      const hash = await currentVoiceHash(talk, ch, parsed);
      if (hash === null) {
        console.error(`${key}: missing recording ${relative(talk.dir, src)} (voice.mode is "own")`);
        failed++;
        continue;
      }
      if (stageStatus(state, "voice", key, hash, voiceOutputs(talk, ch)).status === "fresh") {
        console.log(`${key}: voice fresh, skipped`);
        continue;
      }
      if (own) {
        console.log(`${key}: normalising ${relative(talk.dir, src)}`);
      } else {
        const textFile = paths.spokenText(talk, lang, ch.chapter);
        mkdirSync(dirname(textFile), { recursive: true });
        writeFileSync(textFile, parsed.spokenText + "\n", "utf8");
        mkdirSync(dirname(src), { recursive: true });
        console.log(`${key}: synthesizing ${parsed.words.length} words with ${voiceId(talk, lang)}`);
        const r = await helper.tts(textFile, voiceId(talk, lang), lang, src);
        console.log(`${key}: ${r.duration.toFixed(2)} s at ${r.sample_rate} Hz`);
      }
      await toCanonicalWav(src, canonical);
      if (!existsSync(canonical)) throw new Error(`ffmpeg wrote no ${canonical}`);
      recordStage(state, "voice", key, hash);
      writeState(stateFile, state);
    } catch (e) {
      console.error(`${key}: ${(e as Error).message}`);
      failed++;
    }
  }
  return failed ? 1 : 0;
}
