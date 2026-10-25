import * as helper from "../audio-helper.js";
import { findTool } from "../ffmpeg.js";
import { run } from "../proc.js";

export interface DoctorCheck {
  name: string;
  ok: boolean;
  detail: string;
  optional?: boolean;
}

export const MIN_NODE_MAJOR = 22;
export const PYTHON_VERSION = "3.11";

export async function doctorChecks(): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];
  const major = Number(process.versions.node.split(".")[0]);
  checks.push({ name: "node", ok: major >= MIN_NODE_MAJOR, detail: `v${process.versions.node} (need >= ${MIN_NODE_MAJOR})` });

  for (const t of ["ffmpeg", "ffprobe"] as const) {
    const p = findTool(t);
    checks.push({ name: t, ok: p !== null, detail: p ?? "not on PATH or in the winget location (winget install Gyan.FFmpeg)" });
  }

  const uv = await run("uv", ["--version"]);
  const uvOk = uv.code === 0;
  checks.push({ name: "uv", ok: uvOk, detail: uvOk ? uv.stdout.trim() : "not found (https://docs.astral.sh/uv/)" });

  if (uvOk) {
    const py = await run("uv", ["python", "find", PYTHON_VERSION]);
    checks.push({ name: `python ${PYTHON_VERSION}`, ok: py.code === 0, detail: py.code === 0 ? py.stdout.trim() : `not found (uv python install ${PYTHON_VERSION})` });
    try {
      const m = await helper.models();
      const missing = m.kokoro.files.filter((f) => !f.present).map((f) => f.name);
      checks.push({ name: "kokoro model", ok: m.kokoro.present, detail: m.kokoro.present ? m.cache_dir : `missing ${missing.join(", ")} in ${m.cache_dir} (downloaded on first "talkreel voice")` });
      checks.push({ name: `whisper ${m.whisper.model}`, ok: m.whisper.present, detail: m.whisper.present ? "in the Hugging Face cache" : 'not cached (downloaded on first "talkreel align")' });
      checks.push({ name: "arabic group", ok: m.ctc.available, optional: true, detail: m.ctc.available ? "installed (optional)" : "optional; uv sync --project py --group arabic" });
      checks.push({ name: "Arabic CTC model", ok: m.ctc.present, optional: true, detail: `optional; ${m.ctc.model}@${m.ctc.revision} ${m.ctc.present ? "in the Hugging Face cache" : "not cached (downloaded on first Arabic CTC alignment)"}` });
    } catch (e) {
      checks.push({ name: "audio helper", ok: false, detail: (e as Error).message.split("\n").slice(0, 3).join(" ") });
    }
  } else {
    checks.push({ name: `python ${PYTHON_VERSION}`, ok: false, detail: "needs uv" });
    checks.push({ name: "models", ok: false, detail: "needs uv" });
  }
  return checks;
}

export async function cmdDoctor(json: boolean): Promise<number> {
  if (!json) console.log("checking tools (the first run sets up the Python environment)...");
  const checks = await doctorChecks();
  if (json) console.log(JSON.stringify(checks, null, 2));
  else for (const c of checks) console.log(`  ${c.ok ? "ok     " : c.optional ? "OPTIONAL" : "MISSING"} ${c.name.padEnd(16)} ${c.detail}`);
  return checks.every((c) => c.ok || c.optional) ? 0 : 2;
}
