export type GridSize = "3x3" | "3x4" | "4x4" | "4x5" | "5x5";
export type ContentMode = "numbers" | "lettersUpper" | "lettersLower" | "mixedUpper" | "mixedRandomCase";

export interface BoardResult {
  board: number;
  timeMs: number;
  errors: number;
}

export const GRID_OPTIONS = [
  { value: "3x3", label: "3 x 3", rows: 3, cols: 3 },
  { value: "3x4", label: "3 x 4", rows: 3, cols: 4 },
  { value: "4x4", label: "4 x 4", rows: 4, cols: 4 },
  { value: "4x5", label: "4 x 5", rows: 4, cols: 5 },
  { value: "5x5", label: "5 x 5", rows: 5, cols: 5 },
] as const;

export const CONTENT_OPTIONS: { value: ContentMode; label: string }[] = [
  { value: "numbers", label: "Números" },
  { value: "lettersUpper", label: "Letras mayúsculas" },
  { value: "lettersLower", label: "Letras minúsculas" },
  { value: "mixedUpper", label: "Números + letras" },
  { value: "mixedRandomCase", label: "Números + letras Aa" },
];

export function normalizeBoardCount(value: number): number {
  return Number.isFinite(value) ? Math.min(15, Math.max(1, Math.round(value))) : 3;
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function buildSequence(mode: ContentMode, count: number): string[] {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  if (mode === "numbers") return Array.from({ length: count }, (_, index) => String(index + 1));
  if (mode === "lettersUpper") return letters.slice(0, count);
  if (mode === "lettersLower") return letters.slice(0, count).map((letter) => letter.toLowerCase());
  return Array.from({ length: count }, (_, index) => {
    const pairIndex = Math.floor(index / 2);
    const letter = letters[pairIndex];
    return index % 2 === 0 ? String(pairIndex + 1)
      : mode === "mixedRandomCase" && Math.random() < 0.5 ? letter.toLowerCase() : letter;
  });
}

export function summarizeBoards(results: BoardResult[]) {
  const totals = results.reduce((sum, result) => ({
    timeMs: sum.timeMs + result.timeMs,
    errors: sum.errors + result.errors,
  }), { timeMs: 0, errors: 0 });
  return {
    timeMs: results.length ? totals.timeMs / results.length : 0,
    errors: results.length ? totals.errors / results.length : 0,
  };
}

export function formatElapsed(ms: number): string {
  return `${(ms / 1000).toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;
}
