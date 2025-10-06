const whitespaceRegex = /\s+/g;

export function tokenize(raw: string): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(whitespaceRegex)
    .map((word) => word.trim())
    .filter((word) => word.length > 0);
}
