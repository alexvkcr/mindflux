import { useCallback, useEffect, useReducer, useRef } from "react";
import { createRound, INITIAL_STATE, reducer, SESSION_ROUNDS } from "./engine";
import type { Category } from "./corpus";

export function useKeepTrack() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const remainingRef = useRef(0);
  const { phase, round, itemIndex, paused } = state;

  useEffect(() => {
    if (phase !== "present" || !round || paused) return;
    let timeout: number | undefined;
    let deadline = 0;
    let completed = false;
    const duration = remainingRef.current || round.exposureMs;
    const frame = window.requestAnimationFrame(() => {
      deadline = performance.now() + duration;
      timeout = window.setTimeout(() => {
        completed = true;
        remainingRef.current = round.exposureMs;
        dispatch({ type: "tick", round, itemIndex });
      }, duration);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (timeout !== undefined) window.clearTimeout(timeout);
      if (deadline && !completed) remainingRef.current = Math.max(1, deadline - performance.now());
    };
  }, [phase, round, itemIndex, paused]);

  const start = useCallback(() => {
    remainingRef.current = 0;
    dispatch({ type: "start", round: createRound(state.level) });
  }, [state.level]);
  const begin = useCallback(() => {
    remainingRef.current = state.round?.exposureMs ?? 0;
    dispatch({ type: "begin" });
  }, [state.round]);
  const next = useCallback(() => {
    remainingRef.current = 0;
    dispatch({ type: "next", round: state.results.length < SESSION_ROUNDS ? createRound(state.sessionLevel) : undefined });
  }, [state.results.length, state.sessionLevel]);

  return {
    state,
    configure: (level: number) => dispatch({ type: "configure", level }),
    start,
    begin,
    next,
    pause: () => dispatch({ type: "pause" }),
    setAnswer: (category: Category, value: string) => dispatch({ type: "answer", category, value }),
    submit: () => dispatch({ type: "submit" }),
    restart: () => dispatch({ type: "restart" })
  };
}
