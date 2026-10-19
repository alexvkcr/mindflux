import { useCallback, useEffect, useReducer, useRef } from "react";
import { createRound, INITIAL_STATE, reducer, type SessionLength } from "./engine";

export function useRunningSpan() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const remainingRef = useRef(0);
  const { phase, round, digitIndex, paused } = state;

  useEffect(() => {
    if (phase !== "present" || !round || paused) return;
    let timeout: number | undefined;
    let deadline = 0;
    let completed = false;
    const duration = remainingRef.current || round.exposureMs;
    // Start the fixed interval only after the digit has reached the screen.
    const frame = window.requestAnimationFrame(() => {
      deadline = performance.now() + duration;
      timeout = window.setTimeout(() => {
        completed = true;
        remainingRef.current = round.exposureMs;
        dispatch({ type: "tick", round, digitIndex });
      }, duration);
    });

    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      if (timeout !== undefined) window.clearTimeout(timeout);
      if (deadline && !completed) remainingRef.current = Math.max(1, deadline - performance.now());
    };
  }, [phase, round, digitIndex, paused]);

  const configure = useCallback((level: number, sessionLength: SessionLength) => {
    dispatch({ type: "configure", level, sessionLength });
  }, []);
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
    dispatch({ type: "next", round: state.results.length < state.sessionLength ? createRound(state.sessionLevel) : undefined });
  }, [state.results.length, state.sessionLength, state.sessionLevel]);
  const restart = useCallback(() => {
    dispatch({ type: "restart" });
  }, []);

  return {
    state,
    configure,
    start,
    begin,
    next,
    restart,
    pause: () => dispatch({ type: "pause" }),
    setAnswer: (answer: string) => dispatch({ type: "setAnswer", answer }),
    append: (digit: string) => dispatch({ type: "append", digit }),
    backspace: () => dispatch({ type: "backspace" }),
    submit: () => dispatch({ type: "submit" })
  };
}
