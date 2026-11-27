import { WORDS_BY_SYLLABLES, type SyllableCount } from "./words.ts";
export { SYLLABLE_COUNTS, WORDS_BY_SYLLABLES, type SyllableCount } from "./words.ts";

export type Judgment = "same" | "different";
export const CHANGE_KINDS = ["substitution", "transposition", "accent", "deletion", "insertion", "double", "similar"] as const;
export type ChangeKind = typeof CHANGE_KINDS[number];
export type Challenge = ChangeKind | "all";
export const CHALLENGES: readonly Challenge[] = [...CHANGE_KINDS, "all"];
export const EXPOSURE_MS = [1600, 1400, 1200, 1000, 850, 700, 650, 600, 550, 500, 450, 400, 350] as const;
export type ExposureMs = typeof EXPOSURE_MS[number];
export const SESSION_LENGTHS = [10, 20, 30, 40] as const;
export type SessionLength = typeof SESSION_LENGTHS[number];
export const WORD_DISTANCES = [8, 16, 32, 64, 96] as const;
export type WordDistance = typeof WORD_DISTANCES[number];
export interface SessionConfig {
  exposureMs: ExposureMs;
  comparisons: SessionLength;
  syllables: SyllableCount;
  challenge: Challenge;
  distance: WordDistance;
}
export const DEFAULT_CONFIG: SessionConfig = { exposureMs: 1600, comparisons: 10, syllables: 3, challenge: "all", distance: 32 };
export const WORDS = Object.values(WORDS_BY_SYLLABLES).flat();

export interface Stimulus {
  left: string;
  right: string;
  answer: Judgment;
  change: ChangeKind | "mixed" | null;
  changes: ChangeKind[];
}
export interface ResponseResult extends Stimulus {
  response: Judgment;
  correct: boolean;
}

function randomIndex(length: number, random: () => number): number {
  return Math.min(length - 1, Math.floor(random() * length));
}
function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1, random);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
const LETTERS = "abcdefghijklmnñopqrstuvwxyzáéíóúü";
const ACCENTS: Record<string, string> = { a: "á", e: "é", i: "í", o: "ó", u: "ú", á: "a", é: "e", í: "i", ó: "o", ú: "u" };
const SIMILAR: Record<string, string> = { a: "o", o: "a", c: "e", e: "c", b: "d", d: "b", p: "q", q: "p", m: "n", n: "m", u: "v", v: "u", i: "l", l: "i", f: "t", t: "f", s: "z", z: "s", g: "q", h: "n", r: "n", á: "ó", ó: "á", é: "c", í: "l", ú: "v", ñ: "m", ü: "v" };

export function transformWord(word: string, kind: ChangeKind, random: () => number = Math.random): string {
  const source = [...word.normalize("NFC")];
  if (!source.length) return word;
  const positions = source.map((_, i) => i);
  const choose = (items: number[]) => items[randomIndex(items.length, random)];
  const substitute = (i: number) => {
    const candidates = [...LETTERS].filter(letter => letter !== source[i] && letter !== ACCENTS[source[i]]);
    source[i] = candidates[randomIndex(candidates.length, random)];
  };
  if (kind === "accent" || kind === "similar") {
    const map = kind === "accent" ? ACCENTS : SIMILAR;
    const eligible = positions.filter(i => map[source[i]]);
    if (!eligible.length) return word;
    const i = choose(eligible);
    source[i] = map[source[i]];
  } else if (kind === "transposition") {
    const eligible = positions.filter(i => i + 1 < source.length && source[i] !== source[i + 1]);
    if (!eligible.length) return word;
    const i = choose(eligible);
    [source[i], source[i + 1]] = [source[i + 1], source[i]];
  } else if (kind === "deletion") {
    source.splice(choose(positions), 1);
  } else if (kind === "insertion") {
    const i = randomIndex(source.length + 1, random);
    const candidates = [...LETTERS].filter(letter => letter !== source[i] && letter !== source[i - 1]);
    source.splice(i, 0, candidates[randomIndex(candidates.length, random)]);
  } else if (kind === "double") {
    if (source.length < 2) return word;
    const first = choose(positions);
    const second = choose(positions.filter(i => i !== first));
    substitute(first);
    substitute(second);
  } else {
    substitute(choose(positions));
  }
  return source.join("").normalize("NFC");
}

export function createDifferent(word: string, challenge: Challenge, random: () => number = Math.random): Stimulus {
  const left = word.normalize("NFC");
  const kinds = challenge === "all" ? shuffle([...CHANGE_KINDS], random) : [challenge];
  for (const kind of kinds) {
    const first = transformWord(left, kind, random);
    if (first === left) continue;
    if (challenge === "all" && random() < 0.35) {
      for (const second of shuffle(CHANGE_KINDS.filter(k => k !== kind), random)) {
        for (let attempt = 0; attempt < 12; attempt++) {
          const right = transformWord(first, second, random);
          if (right === first || right === left) continue;
          // For equal-length operations, keep their affected positions distinct so neither masks the other.
          if (first.length === left.length && right.length === first.length &&
              [...left].some((letter, i) => letter !== first[i] && first[i] !== right[i])) continue;
          return { left, right, answer: "different", change: "mixed", changes: [kind, second] };
        }
      }
    }
    return { left, right: first, answer: "different", change: kind, changes: [kind] };
  }
  throw new Error("No eligible transformation for " + left + " (" + challenge + ")");
}

export function createSession(config: SessionConfig, random: () => number = Math.random): Stimulus[] {
  const pool = WORDS_BY_SYLLABLES[config.syllables];
  if (pool.length < config.comparisons) throw new Error("Insufficient words for session");
  const words = shuffle([...pool], random).slice(0, config.comparisons);
  const answers = shuffle(Array.from({ length: config.comparisons }, (_, i): Judgment => i < config.comparisons / 2 ? "same" : "different"), random);
  return answers.map((answer, i) => answer === "same"
    ? { left: words[i], right: words[i], answer, change: null, changes: [] }
    : createDifferent(words[i], config.challenge, random));
}
export function evaluate(stimulus: Stimulus, response: Judgment): ResponseResult {
  return { ...stimulus, response, correct: response === stimulus.answer };
}
export function summarize(results: ResponseResult[]) {
  const hits = results.filter(result => result.correct).length;
  return {
    hits,
    differentAsSame: results.filter(result => result.answer === "different" && result.response === "same").length,
    sameAsDifferent: results.filter(result => result.answer === "same" && result.response === "different").length,
    accuracy: results.length ? Math.round((hits / results.length) * 100) : 0,
    misses: results.filter(result => !result.correct)
  };
}
