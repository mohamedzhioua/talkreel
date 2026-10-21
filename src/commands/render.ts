import type { Talk } from "../talk.js";

export interface RenderOptions {
  lang: string;
  chapter?: string;
  quality: string;
  telemetry: boolean;
}

export async function cmdRender(_talk: Talk, _opts: RenderOptions): Promise<number> {
  console.error("talkreel render: not implemented yet");
  return 1;
}
