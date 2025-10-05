// Mapea level 1..9 a intervalos ms más ágiles.
// Opción por tabla (fácil de afinar) + opción exponencial comentada.
const TABLE_MS = [600, 520, 450, 380, 320, 260, 210, 160, 120] as const;
// Alternativa exponencial (descomentar si se prefiere):
// const expo = (lvl: number) => Math.max(90, Math.round(600 * Math.pow(0.78, lvl - 1)));

export function getIntervalMs(level: number): number {
  const idx = Math.min(8, Math.max(0, Math.floor(level - 1)));
  return TABLE_MS[idx];
  // return expo(level);
}