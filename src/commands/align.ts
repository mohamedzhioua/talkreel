import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import * as helper from "../audio-helper.js";
import { buildCaptions } from "../align-map.js";
import { parseScriptFile } from "../script.js";
import { currentAlignHash, currentVoiceHash, voiceOutputs } from "../stages.js";
import { chapterKey, readState, recordStage, stageStatus, WHISPER_MODEL, writeState } from "../state.js";
import { paths, selectChapters, type Talk } from "../talk.js";
import { readWavInfo } from "../wav.js";

function writeJson(file: string, v: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(v, null, 2) + "\n", "utf8");
}

export async function cmdAlign(talk: Talk, lang: string, chapter?: string): Promise<number> {
  const chapters = selectChapters(talk, lang, chapter);
  if (!chapters.length) {
    console.error(`no chapters in script/${lang}/`);
    return 1;
  }
  const stateFile = paths.state(talk);
  const state = readState(stateFile);
  let failed = 0;
  for (const ch of chapters) {
    const key = chapterKey(lang, ch.chapter);
    try {
      const parsed = parseScriptFile(ch.file);
      const voice = stageStatus(state, "voice", key, await currentVoiceHash(talk, ch, parsed), voiceOutputs(talk, ch));
      if (voice.status !== "fresh") {
        console.error(`${key}: voice is stale (${voice.reason}); run "talkreel voice" first`);
        failed++;
        continue;
      }
      const hash = await currentAlignHash(talk, ch, parsed);
      const captionsFile = paths.captions(talk, lang, ch.chapter);
      if (hash !== null && stageStatus(state, "align", key, hash, [captionsFile]).status === "fresh") {
        console.log(`${key}: align fresh, skipped`);
        continue;
      }
      const wav = paths.narrationWav(talk, lang, ch.chapter);
      console.log(`${key}: aligning with whisper ${WHISPER_MODEL}`);
      const heard = await helper.align(wav, lang, WHISPER_MODEL);
      writeJson(paths.whisperRaw(talk, lang, ch.chapter), heard);
      const captions = buildCaptions(lang, parsed.words, heard.words, { duration: readWavInfo(wav).duration });
      const matched = captions.words.filter((w) => w.matched).length;
      writeJson(captionsFile, captions);
      console.log(`${key}: ${matched} of ${captions.words.length} words matched (${((matched / captions.words.length) * 100).toFixed(1)}%)`);
      recordStage(state, "align", key, hash!);
      writeState(stateFile, state);
    } catch (e) {
      console.error(`${key}: ${(e as Error).message}`);
      failed++;
    }
  }
  return failed ? 1 : 0;
}
