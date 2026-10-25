// Token normalisation shared by script parsing and alignment.

/**
 * Normalise one token for comparison: lowercase, accents folded, tatweel removed, "%" and "&" spelled out,
 * every other non letter/digit removed (so hyphens and dots join the parts).
 */
export function normToken(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/%/g, "percent")
    .replace(/&/g, "and")
    .replace(/\u0640/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}
