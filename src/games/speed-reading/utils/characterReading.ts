export interface CharacterLine {
  start: number;
  end: number;
  text: string;
}

export function normalizeReadingText(text: string): string {
  return text.trim().replace(/\s+/gu, " ");
}

export function highlightedParts(line: CharacterLine, start: number, end: number) {
  const characters = Array.from(line.text);
  const from = Math.max(0, start - line.start);
  const to = Math.min(characters.length, end - line.start);
  if (from >= to) return { before: line.text, active: "", after: "" };
  return {
    before: characters.slice(0, from).join(""),
    active: characters.slice(from, to).join(""),
    after: characters.slice(to).join(""),
  };
}
