import { useCallback, useEffect, useReducer } from "react";
import {
  DEFAULT_MEMORY_CONFIG,
  generateSequence,
  normalizeExposure,
  normalizeLength,
  sanitizeAnswer,
  type MemoryConfig,
} from "./utils";

type Phase = "ready" | "countdown" | "memorizing" | "answering" | "result";
interface Round extends MemoryConfig {
  sequence: string;
}
interface State {
  config: MemoryConfig;
  phase: Phase;
  countdown: number;
  round: Round | null;
  answer: string;
}
type Action =
  | { type: "configure"; config: Partial<MemoryConfig> }
  | { type: "start"; round: Round }
  | { type: "tick"; round: Round }
  | { type: "hide"; round: Round }
  | { type: "answer"; answer: string }
  | { type: "reveal" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "configure": {
      if (state.phase !== "ready" && state.phase !== "result") return state;
      const config = { ...state.config, ...action.config };
      return { ...state, config: { ...config, length: normalizeLength(config.length), exposureMs: normalizeExposure(config.exposureMs) } };
    }
    case "start":
      return state.phase === "ready" || state.phase === "result"
        ? { ...state, phase: "countdown", countdown: 3, round: action.round, answer: "" }
        : state;
    case "tick":
      if (state.phase !== "countdown" || state.round !== action.round) return state;
      return state.countdown > 1
        ? { ...state, countdown: state.countdown - 1 }
        : { ...state, phase: "memorizing", countdown: 0 };
    case "hide":
      return state.phase === "memorizing" && state.round === action.round ? { ...state, phase: "answering" } : state;
    case "answer":
      return state.phase === "answering" && state.round
        ? { ...state, answer: sanitizeAnswer(action.answer, state.round.mode, state.round.length) }
        : state;
    case "reveal":
      return state.phase === "answering" ? { ...state, phase: "result" } : state;
  }
}

export function useMemoryGame() {
  const [state, dispatch] = useReducer(reducer, {
    config: DEFAULT_MEMORY_CONFIG,
    phase: "ready",
    countdown: 0,
    round: null,
    answer: "",
  });
  const { config, phase, round } = state;

  useEffect(() => {
    if (phase !== "countdown" || !round) return;
    const timeout = window.setTimeout(() => dispatch({ type: "tick", round }), 1000);
    return () => window.clearTimeout(timeout);
  }, [phase, round, state.countdown]);

  useEffect(() => {
    if (phase !== "memorizing" || !round) return;
    let timeout: number | undefined;
    // Schedule after the sequence is committed, without an appearance animation.
    const frame = requestAnimationFrame(() => {
      const deadline = performance.now() + round.exposureMs;
      const schedule = () => {
        const remaining = deadline - performance.now();
        if (remaining <= 0) {
          dispatch({ type: "hide", round });
          return;
        }
        // Long custom exposures must not overflow the browser's timer limit.
        timeout = window.setTimeout(schedule, Math.min(remaining, 2_147_483_647));
      };
      schedule();
    });
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [phase, round]);

  const configure = useCallback((next: Partial<MemoryConfig>) => dispatch({ type: "configure", config: next }), []);
  const start = useCallback(() => {
    dispatch({ type: "start", round: { ...config, sequence: generateSequence(config.mode, config.length) } });
  }, [config]);
  const setAnswer = useCallback((answer: string) => dispatch({ type: "answer", answer }), []);
  const reveal = useCallback(() => dispatch({ type: "reveal" }), []);

  return { ...state, configure, start, setAnswer, reveal, locked: phase === "countdown" || phase === "memorizing" || phase === "answering" };
}
