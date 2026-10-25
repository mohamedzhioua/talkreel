#!/usr/bin/env node
// talkreel CLI. Exit codes: 0 ok, 1 a stage failed, 2 a tool is missing (doctor).
import { parseArgs, type ParseArgsConfig } from "node:util";
import { cmdAlign } from "./commands/align.js";
import { cmdCheck } from "./commands/check.js";
import { cmdDoctor } from "./commands/doctor.js";
import { cmdFrames } from "./commands/frames.js";
import { cmdNew } from "./commands/new.js";
import { cmdRender } from "./commands/render.js";
import { cmdStatus } from "./commands/status.js";
import { cmdVoice } from "./commands/voice.js";
import { loadTalk, TalkError } from "./talk.js";

const USAGE = `usage: talkreel <command> [options]

commands:
  new <slug> --title "<title>"     create talks/<slug>/
  status [--json]                  per-chapter, per-stage stale/fresh
  doctor [--json]                  check Node, FFmpeg, uv, Python 3.11 and the models
  check                            validate scripts and scenes: unknown [s:id], unsourced
                                   stat/quote blocks, and every scene rule that needs no timing
  voice [--lang en] [--chapter NN] synthesize (or normalise own) narration
  align [--lang en] [--chapter NN] word-timed captions from the narration
  render [--lang en] [--chapter NN] [--quality standard|draft] [--telemetry]
                                   render, join, and mix the music bed when talk.json has music
  frames [--lang en] [--chapter NN] [--safe-zones]

common options:
  --talk <path>                    talk folder (default: current directory)`;

const common = {
  talk: { type: "string" },
  help: { type: "boolean", short: "h" },
} as const;

const chapterOpts = {
  ...common,
  lang: { type: "string" },
  chapter: { type: "string" },
} as const;

const OPTIONS = {
  new: { ...common, title: { type: "string" } },
  status: { ...common, json: { type: "boolean" } },
  doctor: { ...common, json: { type: "boolean" } },
  check: common,
  voice: chapterOpts,
  align: chapterOpts,
  render: { ...chapterOpts, quality: { type: "string" }, telemetry: { type: "boolean" } },
  frames: { ...chapterOpts, "safe-zones": { type: "boolean" } },
} satisfies Record<string, ParseArgsConfig["options"]>;

type Command = keyof typeof OPTIONS;

async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === "-h" || cmd === "--help" || cmd === "help") {
    console.log(USAGE);
    return cmd ? 0 : 1;
  }
  if (!(cmd in OPTIONS)) {
    console.error(`unknown command "${cmd}"\n\n${USAGE}`);
    return 1;
  }
  const command = cmd as Command;
  const { values: v, positionals } = parseArgs({ args: rest, options: OPTIONS[command], allowPositionals: command === "new", strict: true });
  const values = v as Record<string, string | boolean | undefined>;
  if (values.help) {
    console.log(USAGE);
    return 0;
  }
  const str = (k: string) => (typeof values[k] === "string" ? (values[k] as string) : undefined);
  const talkDir = str("talk") ?? process.cwd();

  if (command === "new") return cmdNew(talkDir, positionals[0], str("title"));
  if (command === "doctor") return cmdDoctor(values.json === true);

  const talk = loadTalk(talkDir);
  const lang = str("lang") ?? talk.config.languages[0]!;
  if (command !== "status" && command !== "check" && !talk.config.languages.includes(lang)) {
    throw new TalkError(`language "${lang}" is not in talk.json languages`);
  }
  switch (command) {
    case "status":
      return cmdStatus(talk, values.json === true);
    case "check":
      return cmdCheck(talk);
    case "voice":
      return cmdVoice(talk, lang, str("chapter"));
    case "align":
      return cmdAlign(talk, lang, str("chapter"));
    case "render":
      return cmdRender(talk, { lang, chapter: str("chapter"), quality: str("quality") ?? "standard", telemetry: values.telemetry === true });
    case "frames":
      return cmdFrames(talk, { lang, chapter: str("chapter"), safeZones: values["safe-zones"] === true });
  }
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    console.error(e instanceof TalkError || e instanceof TypeError ? (e as Error).message : e);
    process.exitCode = 1;
  },
);
