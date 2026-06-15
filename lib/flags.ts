// Maps subdivision flag emojis (not supported on Windows) to flagcdn.com codes
const SUBDIVISION_MAP: Record<string, string> = {
  "🏴󠁧󠁢󠁳󠁣󠁴󠁿": "gb-sct",
  "🏴󠁧󠁢󠁥󠁮󠁧󠁿": "gb-eng",
  "🏴󠁧󠁢󠁷󠁬󠁳󠁿": "gb-wls",
};

export function emojiToFlagCode(emoji: string): string | null {
  if (SUBDIVISION_MAP[emoji]) return SUBDIVISION_MAP[emoji];
  const codePoints = [...emoji].map((c) => c.codePointAt(0) ?? 0);
  if (
    codePoints.length === 2 &&
    codePoints[0] >= 0x1f1e6 &&
    codePoints[0] <= 0x1f1ff
  ) {
    const a = String.fromCharCode(codePoints[0] - 0x1f1e6 + 0x41);
    const b = String.fromCharCode(codePoints[1] - 0x1f1e6 + 0x41);
    return (a + b).toLowerCase();
  }
  return null;
}

export function getFlagUrl(emoji: string, width = 40): string | null {
  const code = emojiToFlagCode(emoji);
  return code ? `https://flagcdn.com/w${width}/${code}.png` : null;
}
