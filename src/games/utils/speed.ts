// Base 1..9 table and dynamic expansion to smooth the level progression.
const BASE_TABLE_MS = [600, 520, 450, 380, 320, 260, 210, 160, 120] as const;

const EXTRA_LEVELS_PER_SEGMENT = 2;
const FIRST_SEGMENT_WITH_EXTRAS_IDX = 3; // level 4 (zero-based index)

const EXTENDED_TABLE_MS = (() => {
  const result: number[] = [];

  for (let idx = 0; idx < BASE_TABLE_MS.length - 1; idx += 1) {
    const current = BASE_TABLE_MS[idx];
    const next = BASE_TABLE_MS[idx + 1];
    result.push(current);

    if (idx >= FIRST_SEGMENT_WITH_EXTRAS_IDX && EXTRA_LEVELS_PER_SEGMENT > 0) {
      const step = (next - current) / (EXTRA_LEVELS_PER_SEGMENT + 1);
      for (let extra = 1; extra <= EXTRA_LEVELS_PER_SEGMENT; extra += 1) {
        result.push(Math.round(current + step * extra));
      }
    }
  }

  result.push(BASE_TABLE_MS[BASE_TABLE_MS.length - 1]);
  return result;
})();

export const EYE_MOVEMENT_MIN_LEVEL = 1;
export const EYE_MOVEMENT_MAX_LEVEL = EXTENDED_TABLE_MS.length;

export function getIntervalMs(level: number): number {
  const normalized = Number.isFinite(level) ? Math.round(level) : EYE_MOVEMENT_MIN_LEVEL;
  const idx = Math.min(EYE_MOVEMENT_MAX_LEVEL - 1, Math.max(0, normalized - 1));
  return EXTENDED_TABLE_MS[idx];
}
