/**
 * Multipart `filename` is often exposed as a Latin-1 string of the raw UTF-8 bytes
 * (e.g. «Снимок...» → «Ð¡Ð½Ð¸Ð¼Ð¾Ðº...»). Re-decode to UTF-8 when that pattern applies.
 * Safe for plain ASCII: Buffer latin1 → utf8 is a no-op for 7-bit text.
 * Safe for already-correct UTF-8 in JavaScript: we only replace when the decoded
 * string is clearly a better (e.g. Cyrillic) result than the input.
 */
export function decodeMultipartFilename(name: string): string {
  if (!name) return name;
  const asUtf8 = Buffer.from(name, 'latin1').toString('utf8');
  if (asUtf8.includes('\uFFFD')) {
    return name;
  }
  const hasCyrillic = (s: string) => /[\u0400-\u04FF]/.test(s);
  const hasCjk = (s: string) => /[\u4E00-\u9FFF]/.test(s);
  if (
    (hasCyrillic(asUtf8) && !hasCyrillic(name)) ||
    (hasCjk(asUtf8) && !hasCjk(name))
  ) {
    return asUtf8;
  }
  return name;
}
