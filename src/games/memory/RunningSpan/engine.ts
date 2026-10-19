export const LEVELS = [
  { k: 3, exposureMs: 1500 },
  { k: 3, exposureMs: 1100 },
  { k: 4, exposureMs: 1100 },
  { k: 4, exposureMs: 800 },
  { k: 5, exposureMs: 800 },
  { k: 5, exposureMs: 600 },
  { k: 6, exposureMs: 600 },
  { k: 7, exposureMs: 450 },
  { k: 8, exposureMs: 350 }
] as const;

export type Phase = "idle" | "prepare" | "present" | "answer" | "correct" | "finished";
export type SessionLength = 5 | 10 | 20;

export interface Round {
  level: number;
  k: number;
  exposureMs: number;
  sequence: string;
}

export interface PositionResult {
  expected: string;
  actual: string;
  correct: boolean;
}

export interface RoundResult {
  round: number;
  totalLength: number;
  expected: string;
  answer: string;
  positions: PositionResult[];
  correctCount: number;
  complete: boolean;
}

export interface State {
  phase: Phase;
  level: number;
  sessionLength: SessionLength;
  sessionLevel: number;
  roundNumber: number;
  round: Round | null;
  digitIndex: number;
  answer: string;
  paused: boolean;
  results: RoundResult[];
}

export type Action =
  | { type: "configure"; level?: number; sessionLength?: SessionLength }
  | { type: "start"; round: Round }
  | { type: "begin" }
  | { type: "tick"; round: Round; digitIndex: number }
  | { type: "pause" }
  | { type: "setAnswer"; answer: string }
  | { type: "append"; digit: string }
  | { type: "backspace" }
  | { type: "submit" }
  | { type: "next"; round?: Round }
  | { type: "restart" };

export const INITIAL_STATE: State = {
  phase: "idle", level: 1, sessionLength: 5, sessionLevel: 1,
  roundNumber: 0, round: null, digitIndex: 0, answer: "", paused: false, results: []
};

export function normalizeLevel(level: number): number {
  return Number.isFinite(level) ? Math.max(1, Math.min(9, Math.round(level))) : 1;
}

export function createRound(level: number, random: () => number = Math.random): Round {
  const normalized = normalizeLevel(level);
  const { k, exposureMs } = LEVELS[normalized - 1];
  const min = 2 * k + 2;
  const max = 4 * k + 4;
  const length = min + Math.min(max - min, Math.floor(random() * (max - min + 1)));
  const sequence = Array.from({ length }, () => String(Math.min(9, Math.floor(random() * 10)))).join("");
  return { level: normalized, k, exposureMs, sequence };
}

export function lastK(sequence: string, k: number): string {
  return sequence.slice(-k);
}

export function sanitizeAnswer(answer: string, k: number): string {
  return answer.replace(/[^0-9]/g, "").slice(0, k);
}

export function evaluateRound(round: Round, answer: string, roundNumber: number): RoundResult {
  const expected = lastK(round.sequence, round.k);
  const normalizedAnswer = sanitizeAnswer(answer, round.k);
  const positions = [...expected].map((digit, index) => ({
    expected: digit,
    actual: normalizedAnswer[index] ?? "",
    correct: normalizedAnswer[index] === digit
  }));
  const correctCount = positions.filter((position) => position.correct).length;
  return {
    round: roundNumber,
    totalLength: round.sequence.length,
    expected,
    answer: normalizedAnswer,
    positions,
    correctCount,
    complete: correctCount === round.k
  };
}

export function summarize(results: RoundResult[]) {
  const positions = results.reduce((sum, result) => sum + result.positions.length, 0);
  const correctPositions = results.reduce((sum, result) => sum + result.correctCount, 0);
  return {
    completeRounds: results.filter((result) => result.complete).length,
    correctPositions,
    positions,
    percentage: positions ? Math.round((correctPositions / positions) * 100) : 0
  };
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "configure":
      if (state.phase !== "idle" && state.phase !== "finished") return state;
      return {
        ...state,
        level: action.level === undefined ? state.level : normalizeLevel(action.level),
        sessionLength: action.sessionLength ?? state.sessionLength
      };
    case "start":
      if (state.phase !== "idle" && state.phase !== "finished") return state;
      return { ...state, phase: "prepare", sessionLevel: action.round.level, roundNumber: 1,
        round: action.round, digitIndex: 0, answer: "", paused: false, results: [] };
    case "begin":
      return state.phase === "prepare" && state.round
        ? { ...state, phase: "present", digitIndex: 0, paused: false } : state;
    case "tick":
      if (state.phase !== "present" || state.paused || state.round !== action.round || state.digitIndex !== action.digitIndex) return state;
      return state.digitIndex + 1 < state.round.sequence.length
        ? { ...state, digitIndex: state.digitIndex + 1 }
        : { ...state, phase: "answer", digitIndex: 0 };
    case "pause":
      return state.phase === "present" ? { ...state, paused: !state.paused } : state;
    case "setAnswer":
      return state.phase === "answer" && state.round
        ? { ...state, answer: sanitizeAnswer(action.answer, state.round.k) } : state;
    case "append":
      return state.phase === "answer" && state.round && /^[0-9]$/.test(action.digit)
        ? { ...state, answer: sanitizeAnswer(state.answer + action.digit, state.round.k) } : state;
    case "backspace":
      return state.phase === "answer" ? { ...state, answer: state.answer.slice(0, -1) } : state;
    case "submit":
      return state.phase === "answer" && state.round
        ? { ...state, phase: "correct", results: [...state.results, evaluateRound(state.round, state.answer, state.roundNumber)] }
        : state;
    case "next":
      if (state.phase !== "correct") return state;
      return state.results.length >= state.sessionLength
        ? { ...state, phase: "finished", round: null, answer: "" }
        : action.round ? { ...state, phase: "prepare", roundNumber: state.roundNumber + 1,
          round: action.round, digitIndex: 0, answer: "", paused: false } : state;
    case "restart":
      return { ...INITIAL_STATE, level: state.level, sessionLength: state.sessionLength };
  }
}
