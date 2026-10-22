import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Talks are the author's own work: they live in talks/, which git ignores, and are never committed.
const ROOT = fileURLToPath(new URL("..", import.meta.url));

function trackedUnder(dir: string): string[] | null {
  try {
    return execFileSync("git", ["ls-files", "--", dir], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
  } catch {
    return null; // not a git checkout
  }
}

describe("disclosure", () => {
  it("git ignores the talks folder", () => {
    const lines = readFileSync(`${ROOT}/.gitignore`, "utf8").split(/\r?\n/).map((l) => l.trim());
    expect(lines).toContain("talks/");
  });

  it("no talk file is tracked", () => {
    const tracked = trackedUnder("talks");
    if (tracked === null) return;
    expect(tracked).toEqual([]);
  });
});
