import type { Talk } from "../talk.js";

export interface FramesOptions {
  lang: string;
  chapter?: string;
}

export async function cmdFrames(_talk: Talk, _opts: FramesOptions): Promise<number> {
  console.error("talkreel frames: not implemented yet");
  return 1;
}
