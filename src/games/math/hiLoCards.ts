export const SHOE_OPTIONS = [
  ...Array.from({ length: 9 }, (_, index) => ({ label: `${index + 1} ${index ? 'mazos' : 'mazo'}`, value: index + 1 })),
  { label: 'Nivel 10 (18 mazos)', value: 18 }
];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUITS = ['\u2660', '\u2665', '\u2666', '\u2663'];
const SUIT_IMAGE_NAMES: Record<string, string> = { '\u2660': 'spades', '\u2665': 'hearts', '\u2666': 'diamonds', '\u2663': 'clubs' };

export function shuffle<T>(items: readonly T[], random = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function buildShoe(size: number, random = Math.random): string[] {
  return shuffle(Array.from({ length: size }, () => RANKS.flatMap(rank => SUITS.map(suit => `${rank}${suit}`))).flat(), random);
}

export function getCardValue(rank: string): number {
  return ['2', '3', '4', '5', '6'].includes(rank) ? 1 : ['7', '8', '9'].includes(rank) ? 0 : -1;
}

export function getCardImageSrc(card: string, base = import.meta.env.BASE_URL): string {
  return `${base}assets/cards-game/${card.slice(0, -1)}-${SUIT_IMAGE_NAMES[card.at(-1) ?? '']}.png`;
}

/** One shuffled shoe, reshuffled at exhaustion without changing the running count. */
export function createCardDealer(size: number, random = Math.random): () => string {
  let shoe = buildShoe(size, random);
  let index = 0;
  return () => {
    if (index === shoe.length) { shoe = shuffle(shoe, random); index = 0; }
    return shoe[index++];
  };
}
