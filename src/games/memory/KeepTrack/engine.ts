import { CATEGORY_LABELS, CORPUS, type Category } from "./corpus.ts";

export const LEVELS = [
  { categories: 2, minWords: 8, maxWords: 12, exposureMs: 2200 },
  { categories: 2, minWords: 8, maxWords: 12, exposureMs: 2000 },
  { categories: 2, minWords: 8, maxWords: 12, exposureMs: 1800 },
  { categories: 3, minWords: 12, maxWords: 18, exposureMs: 1600 },
  { categories: 3, minWords: 12, maxWords: 18, exposureMs: 1400 },
  { categories: 3, minWords: 12, maxWords: 18, exposureMs: 1200 },
  { categories: 4, minWords: 18, maxWords: 24, exposureMs: 1000 },
  { categories: 4, minWords: 18, maxWords: 24, exposureMs: 800 },
  { categories: 5, minWords: 25, maxWords: 30, exposureMs: 650 }
] as const;

export const SESSION_ROUNDS = 5;
export type Phase = "idle" | "prepare" | "present" | "answer" | "correct" | "finished";
export interface Item { category: Category; word: string }
export interface Round { level: number; categories: Category[]; items: Item[]; exposureMs: number }
export interface AnswerRow { category: Category; expected: string; actual: string; correct: boolean }
export interface RoundResult { round: number; rows: AnswerRow[]; correctCount: number; sequence: Item[] }

export interface State {
  phase: Phase;
  level: number;
  sessionLevel: number;
  roundNumber: number;
  round: Round | null;
  itemIndex: number;
  paused: boolean;
  answers: Partial<Record<Category, string>>;
  results: RoundResult[];
}

export type Action =
  | { type: "configure"; level: number }
  | { type: "start"; round: Round }
  | { type: "begin" }
  | { type: "tick"; round: Round; itemIndex: number }
  | { type: "pause" }
  | { type: "answer"; category: Category; value: string }
  | { type: "submit" }
  | { type: "next"; round?: Round }
  | { type: "restart" };

export const INITIAL_STATE: State = {
  phase: "idle", level: 1, sessionLevel: 1, roundNumber: 0,
  round: null, itemIndex: 0, paused: false, answers: {}, results: []
};

export function normalizeLevel(level: number): number {
  return Number.isFinite(level) ? Math.max(1, Math.min(9, Math.round(level))) : 1;
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

export function createRound(level: number, random: () => number = Math.random): Round {
  const normalized = normalizeLevel(level);
  const config = LEVELS[normalized - 1];
  const categories = shuffle(Object.keys(CORPUS) as Category[], random).slice(0, config.categories);
  const total = config.minWords + randomIndex(config.maxWords - config.minWords + 1, random);
  const counts = Object.fromEntries(categories.map((category) => [category, 2])) as Record<Category, number>;
  for (let i = categories.length * 2; i < total; i++) {
    const available = categories.filter((category) => counts[category] < CORPUS[category].length);
    counts[available[randomIndex(available.length, random)]]++;
  }
  // Every category recurs, but the number of recurrences should offer no fixed cue.
  if (new Set(categories.map((category) => counts[category])).size === 1) {
    const donors = categories.filter((category) => counts[category] > 2);
    const donor = donors[randomIndex(donors.length, random)];
    const receivers = categories.filter((category) => category !== donor && counts[category] < CORPUS[category].length);
    const receiver = receivers[randomIndex(receivers.length, random)];
    counts[donor]--;
    counts[receiver]++;
  }
  const items = shuffle(categories.flatMap((category) =>
    shuffle([...CORPUS[category]], random).slice(0, counts[category]).map((word) => ({ category, word }))
  ), random);
  return { level: normalized, categories, items, exposureMs: config.exposureMs };
}

export function latestByCategory(round: Round): Record<Category, string> {
  const latest = {} as Record<Category, string>;
  for (const item of round.items) latest[item.category] = item.word;
  return latest;
}

export function normalizeAnswer(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("es")
    .replace(/[áàâä]/g, "a").replace(/[éèêë]/g, "e")
    .replace(/[íìîï]/g, "i").replace(/[óòôö]/g, "o")
    .replace(/[úùûü]/g, "u");
}

export function evaluateRound(round: Round, answers: Partial<Record<Category, string>>, roundNumber: number): RoundResult {
  const latest = latestByCategory(round);
  const rows = round.categories.map((category) => {
    const actual = answers[category]?.trim() ?? "";
    return { category, expected: latest[category], actual, correct: actual.length > 0 && normalizeAnswer(actual) === normalizeAnswer(latest[category]) };
  });
  return { round: roundNumber, rows, correctCount: rows.filter((row) => row.correct).length, sequence: round.items };
}

export function summarize(results: RoundResult[]) {
  const categories = results.reduce((sum, result) => sum + result.rows.length, 0);
  const correct = results.reduce((sum, result) => sum + result.correctCount, 0);
  return { correct, categories, percentage: categories ? Math.round((correct / categories) * 100) : 0 };
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "configure":
      return state.phase === "idle" || state.phase === "finished"
        ? { ...state, level: normalizeLevel(action.level) } : state;
    case "start":
      return state.phase === "idle" || state.phase === "finished"
        ? { ...state, phase: "prepare", sessionLevel: action.round.level, roundNumber: 1, round: action.round,
          itemIndex: 0, paused: false, answers: {}, results: [] } : state;
    case "begin":
      return state.phase === "prepare" && state.round
        ? { ...state, phase: "present", itemIndex: 0, paused: false } : state;
    case "tick":
      if (state.phase !== "present" || state.paused || state.round !== action.round || state.itemIndex !== action.itemIndex) return state;
      return state.itemIndex + 1 < state.round.items.length
        ? { ...state, itemIndex: state.itemIndex + 1 }
        : { ...state, phase: "answer", itemIndex: 0 };
    case "pause":
      return state.phase === "present" ? { ...state, paused: !state.paused } : state;
    case "answer":
      return state.phase === "answer" && state.round?.categories.includes(action.category)
        ? { ...state, answers: { ...state.answers, [action.category]: action.value } } : state;
    case "submit":
      return state.phase === "answer" && state.round
        ? { ...state, phase: "correct", results: [...state.results, evaluateRound(state.round, state.answers, state.roundNumber)] } : state;
    case "next":
      if (state.phase !== "correct") return state;
      return state.results.length >= SESSION_ROUNDS
        ? { ...state, phase: "finished", round: null, answers: {} }
        : action.round ? { ...state, phase: "prepare", roundNumber: state.roundNumber + 1,
          round: action.round, itemIndex: 0, paused: false, answers: {} } : state;
    case "restart":
      return { ...INITIAL_STATE, level: state.level };
  }
}

export { CATEGORY_LABELS, CORPUS };
