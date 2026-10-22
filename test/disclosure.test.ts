import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The how-i-ship-with-ai talks show a private repo's tooling. Their committed files may name skills
// and hooks, never the private repo, a local path, the OS's working folder or an email address.
const TALKS = ["how-i-ship-with-ai", "how-i-ship-with-ai-v3"].map((slug) => fileURLToPath(new URL(`../talks/${slug}/`, import.meta.url)));
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

  it.each(TALKS)("the talk's committed files carry no private path, repo name or email (%s)", (talk) => {
    const hits = files(talk).flatMap((f) =>
      readFileSync(f, "utf8")
        .split("\n")
        .flatMap((line, i) => FORBIDDEN.filter(([, re]) => re.test(line)).map(([what]) => `${f.slice(talk.length)}:${i + 1}: ${what}`)),
    );
    expect(files(talk).length).toBeGreaterThan(10);
    expect(hits).toEqual([]);
  });
});
