import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The how-i-ship-with-ai talk shows a private repo's tooling. Its committed files may name skills
// and hooks, never the private repo, a local path, the OS's working folder or an email address.
const TALK = fileURLToPath(new URL("../talks/how-i-ship-with-ai/", import.meta.url));
const COMMITTED = /\.(md|html|json)$/;
const FORBIDDEN: [string, RegExp][] = [
  ["a Windows user path", /[A-Za-z]:[\\/]Users[\\/]/i],
  ["the OS working folder", /\.ai-os\b/],
  ["the private OS repo", /your-ai-engineering-os/i],
  ["an email address", /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/],
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return ["build", "out", "audio"].includes(name) ? [] : files(p);
    return COMMITTED.test(name) && name !== "talk.state.json" ? [p] : [];
  });
}

describe("disclosure", () => {
  it("the email pattern catches addresses and spares package versions", () => {
    const email = FORBIDDEN[3]![1];
    expect(email.test("someone@example.org")).toBe(true);
    expect(email.test("> talkreel@0.1.0 typecheck")).toBe(false);
  });

  it("the talk's committed files carry no private path, repo name or email", () => {
    const hits = files(TALK).flatMap((f) =>
      readFileSync(f, "utf8")
        .split("\n")
        .flatMap((line, i) => FORBIDDEN.filter(([, re]) => re.test(line)).map(([what]) => `${f.slice(TALK.length)}:${i + 1}: ${what}`)),
    );
    expect(files(TALK).length).toBeGreaterThan(10);
    expect(hits).toEqual([]);
  });
});
