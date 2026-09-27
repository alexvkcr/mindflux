import { getCardValue } from './hiLoCards.ts';

export const SEATS = [
  { id: 'bottom', label: 'Inferior', angle: 0 },
  { id: 'left', label: 'Izquierda', angle: 90 },
  { id: 'top', label: 'Superior', angle: 180 },
  { id: 'right', label: 'Derecha', angle: 270 }
] as const;
export type Seat = typeof SEATS[number]['id'];
export interface TableConfig {
  rounds: number;
  handSize: number;
  seats: Seat[];
  exposureMs: number;
  gapMs: number;
  shoeSize: number;
}
export const DEFAULT_TABLE_CONFIG: TableConfig = {
  rounds: 1, handSize: 4, seats: SEATS.map(seat => seat.id), exposureMs: 2000, gapMs: 500, shoeSize: 1
};
export const EXPOSURE_OPTIONS = [...Array.from({ length: 8 }, (_, i) => (i + 2) * 100), ...Array.from({ length: 10 }, (_, i) => (i + 1) * 1000)];
export const GAP_OPTIONS = [500, 1000, 1500, 2000];
export type TableRound = { seat: Seat; cards: string[] }[];

export function normalizeTableCount(draft: string, previous: number): number {
  if (!draft.trim()) return previous;
  const value = Number(draft);
  return Number.isFinite(value) ? Math.min(10, Math.max(1, Math.round(value))) : previous;
}
export function parseHiLoAnswer(draft: string): number | null {
  if (!/^[+-]?\d+$/.test(draft.trim())) return null;
  const value = Number(draft);
  return Number.isSafeInteger(value) ? value : null;
}
export function toggleSeat(seats: Seat[], seat: Seat): Seat[] {
  if (seats.includes(seat)) return seats.length > 1 ? seats.filter(value => value !== seat) : seats;
  return SEATS.map(value => value.id).filter(value => value === seat || seats.includes(value));
}
export function planTableRounds(config: TableConfig, draw: () => string): TableRound[] {
  return Array.from({ length: config.rounds }, () => SEATS.filter(seat => config.seats.includes(seat.id))
    .map(seat => ({ seat: seat.id, cards: Array.from({ length: config.handSize }, draw) })));
}
export function scoreTableRound(round: TableRound): number {
  return round.reduce((total, hand) => total + hand.cards.reduce((sum, card) => sum + getCardValue(card.slice(0, -1)), 0), 0);
}

export interface CardPlacement { seat: Seat; index: number; x: number; y: number; width: number; height: number; angle: number }
/** Disjoint bands keep whole hands separated; all cards share one fitted size. */
export function layoutTable(width: number, height: number, handSize: number, seats: readonly Seat[]): CardPlacement[] {
  if (width <= 0 || height <= 0 || !seats.length) return [];
  const pad = Math.min(width, height) * 0.025;
  const band = (height - 2 * pad) * 0.29;
  const middleHeight = height - 4 * pad - 2 * band;
  const halfWidth = (width - 3 * pad) / 2;
  const slots: Record<Seat, { x: number; y: number; w: number; h: number }> = {
    top: { x: width / 2, y: pad + band / 2, w: width - 2 * pad, h: band },
    bottom: { x: width / 2, y: height - pad - band / 2, w: width - 2 * pad, h: band },
    left: { x: pad + halfWidth / 2, y: height / 2, w: halfWidth, h: middleHeight },
    right: { x: width - pad - halfWidth / 2, y: height / 2, w: halfWidth, h: middleHeight }
  };
  // The exposed strip is 30% of card width; the original rank/suit occupy <14%.
  const groupW = 1 + 0.30 * (handSize - 1);
  const groupH = 1.4 + 0.055 * (handSize - 1);
  const cardWidth = Math.min(150, ...seats.map(seat => {
    const slot = slots[seat];
    const sideways = seat === 'left' || seat === 'right';
    return Math.min(slot.w / (sideways ? groupH : groupW), slot.h / (sideways ? groupW : groupH));
  }));
  return SEATS.filter(seat => seats.includes(seat.id)).flatMap(seat => {
    const slot = slots[seat.id];
    const radians = seat.angle * Math.PI / 180;
    return Array.from({ length: handSize }, (_, index) => {
      const dx = (index - (handSize - 1) / 2) * 0.30 * cardWidth;
      const dy = (index - (handSize - 1) / 2) * 0.055 * cardWidth;
      return { seat: seat.id, index, x: slot.x + dx * Math.cos(radians) - dy * Math.sin(radians),
        y: slot.y + dx * Math.sin(radians) + dy * Math.cos(radians), width: cardWidth, height: cardWidth * 1.4, angle: seat.angle };
    });
  });
}
