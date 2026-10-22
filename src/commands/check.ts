import { check, formatIssue } from "../check.js";
import type { Talk } from "../talk.js";

export async function cmdCheck(talk: Talk): Promise<number> {
  const issues = await check(talk);
  for (const i of issues) console.error(formatIssue(i));
  if (issues.length) {
    console.error(`check failed: ${issues.length} issue(s)`);
    return 1;
  }
  console.log("check ok");
  return 0;
}
