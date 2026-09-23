export type MemoryMode = "decimal" | "binary";

export interface MemoryConfig {
  mode: MemoryMode;
  length: number;
  exposureMs: number;
}

export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  mode: "decimal",
  length: 6,
  exposureMs: 1000,
};

export function normalizeLength(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.min(30, Math.round(value))) : 6;
}

export function normalizeExposure(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_MEMORY_CONFIG.exposureMs;
  if (value <= 1500) return Math.max(100, Math.round(value / 100) * 100);
  return Math.max(2000, Math.round(value / 1000) * 1000);
}

export function stepExposure(value: number, direction: -1 | 1): number {
  const current = normalizeExposure(value);
  if (direction === 1) return current < 1500 ? current + 100 : current === 1500 ? 2000 : current + 1000;
  return current <= 1500 ? Math.max(100, current - 100) : current === 2000 ? 1500 : current - 1000;
}

export function generateSequence(mode: MemoryMode, length: number): string {
  const base = mode === "binary" ? 2 : 10;
  return Array.from({ length: normalizeLength(length) }, () => Math.floor(Math.random() * base)).join("");
}

export function sanitizeAnswer(value: string, mode: MemoryMode, length: number): string {
  return value.replace(mode === "binary" ? /[^01]/g : /[^0-9]/g, "").slice(0, length);
}

export function groupSequence(sequence: string, mode: MemoryMode): string[] {
  const size = mode === "binary" ? 6 : 2;
  const groups: string[] = [];
  for (let index = 0; index < sequence.length; index += size) {
    groups.push(sequence.slice(index, index + size));
  }
  return groups;
}

export function compareAnswer(sequence: string, answer: string) {
  return Array.from(sequence, (expected, index) => ({
    expected,
    actual: answer[index] ?? "",
    correct: answer[index] === expected,
  }));
}

export function formatExposure(milliseconds: number): string {
  return (milliseconds / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1, useGrouping: false });
}
