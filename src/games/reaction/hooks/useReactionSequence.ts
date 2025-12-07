import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const COUNTDOWN_STEPS = 3;
const COUNTDOWN_DURATION_MS = 3000;
const RESPONSE_LIMIT_MS = 2000;
const DEFAULT_ATTEMPTS = 10;
const DEFAULT_WAIT_RANGE: [number, number] = [3000, 9000];

export type ReactionPhase = "idle" | "countdown" | "waiting" | "stimulus" | "finished";

export interface ReactionAttemptResult {
  attempt: number;
  timeMs: number;
  success: boolean;
  label: string;
}

export interface ReactionSummary {
  averageMs: number;
  successCount: number;
  attempts: number;
}

interface UseReactionSequenceOptions {
  running: boolean;
  attempts?: number;
  waitRangeMs?: [number, number];
  responseLimitMs?: number;
  paused?: boolean;
  onStimulus?: (attempt: number) => void;
  onAttemptRecorded?: (result: ReactionAttemptResult) => void;
  onFinished?: (results: ReactionAttemptResult[], summary: ReactionSummary) => void;
}

interface ManagedTimer {
  id: number;
  remaining: number;
  startedAt: number;
  run: () => void;
}

interface RegisterResponseOptions {
  success: boolean;
  label: string;
  timeMsOverride?: number;
}

function clampWaitRange(range: [number, number] | undefined): [number, number] {
  const [rawMin, rawMax] = range ?? DEFAULT_WAIT_RANGE;
  const safeMin = Math.max(0, Math.min(rawMin, rawMax));
  const safeMax = rawMax < safeMin ? safeMin + 1 : rawMax;
  return [safeMin, Math.max(safeMin + 1, safeMax)];
}

function randomBetween(min: number, max: number): number {
  if (max <= min) {
    return min;
  }
  const delta = max - min;
  return min + Math.floor(Math.random() * (delta + 1));
}

export function useReactionSequence(options: UseReactionSequenceOptions) {
  const {
    running,
    attempts = DEFAULT_ATTEMPTS,
    waitRangeMs,
    responseLimitMs = RESPONSE_LIMIT_MS,
    paused = false,
    onStimulus,
    onAttemptRecorded,
    onFinished
  } = options;

  const totalAttempts = useMemo(() => Math.max(1, Math.floor(attempts)), [attempts]);
  const [waitMin, waitMax] = useMemo(() => clampWaitRange(waitRangeMs), [waitRangeMs]);

  const [phase, setPhase] = useState<ReactionPhase>("idle");
  const [attempt, setAttempt] = useState(0);
  const [countdownStage, setCountdownStage] = useState(0);
  const [lastResult, setLastResult] = useState<ReactionAttemptResult | null>(null);
  const [summary, setSummary] = useState<ReactionSummary | null>(null);

  const runningRef = useRef(false);
  const phaseRef = useRef<ReactionPhase>("idle");
  const awaitingResponseRef = useRef(false);
  const activeAttemptRef = useRef(0);
  const startTimestampRef = useRef<number | null>(null);
  const resultsRef = useRef<ReactionAttemptResult[]>([]);
  const timersRef = useRef<ManagedTimer[]>([]);
  const responseTimerRef = useRef<ManagedTimer | null>(null);
  const startAttemptRef = useRef<((index: number) => void) | null>(null);
  const completeAttemptRef = useRef<((result: ReactionAttemptResult) => void) | null>(null);

  const updatePhase = useCallback((next: ReactionPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const removeTimer = useCallback((target: ManagedTimer | null) => {
    if (!target) {
      return;
    }
    window.clearTimeout(target.id);
    timersRef.current = timersRef.current.filter((timer) => timer !== target);
  }, []);

  const scheduleTimer = useCallback(
    (task: () => void, delay: number): ManagedTimer => {
      const timer: ManagedTimer = {
        id: 0,
        remaining: Math.max(0, delay),
        startedAt: performance.now(),
        run: () => {
          removeTimer(timer);
          task();
        }
      };

      timer.id = window.setTimeout(timer.run, timer.remaining);
      timersRef.current.push(timer);
      return timer;
    },
    [removeTimer]
  );

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer.id));
    timersRef.current = [];
    responseTimerRef.current = null;
  }, []);

  const pauseTimers = useCallback(() => {
    const now = performance.now();
    timersRef.current.forEach((timer) => {
      window.clearTimeout(timer.id);
      const elapsed = now - timer.startedAt;
      timer.remaining = Math.max(0, timer.remaining - elapsed);
    });
  }, []);

  const resumeTimers = useCallback(() => {
    timersRef.current.forEach((timer) => {
      timer.startedAt = performance.now();
      if (timer.remaining <= 0) {
        timer.run();
        return;
      }
      timer.id = window.setTimeout(timer.run, timer.remaining);
    });
  }, []);

  useEffect(() => {
    if (paused) {
      pauseTimers();
    } else {
      resumeTimers();
    }
  }, [paused, pauseTimers, resumeTimers]);

  const finishGame = useCallback(() => {
    clearTimers();
    awaitingResponseRef.current = false;
    startTimestampRef.current = null;
    const snapshot = resultsRef.current.slice();

    if (snapshot.length === 0) {
      updatePhase("idle");
      return;
    }

    const total = snapshot.reduce((sum, item) => sum + item.timeMs, 0);
    const successCount = snapshot.filter((item) => item.success).length;
    const resultSummary: ReactionSummary = {
      averageMs: Math.round(total / snapshot.length),
      successCount,
      attempts: snapshot.length
    };

    setSummary(resultSummary);
    updatePhase("finished");
    onFinished?.(snapshot, resultSummary);
  }, [clearTimers, onFinished, updatePhase]);

  const startStimulus = useCallback(
    (index: number) => {
      if (!runningRef.current) {
        return;
      }
      updatePhase("stimulus");
      awaitingResponseRef.current = true;
      activeAttemptRef.current = index;
      startTimestampRef.current = performance.now();

      responseTimerRef.current = scheduleTimer(() => {
        completeAttemptRef.current?.({
          attempt: index,
          success: false,
          timeMs: responseLimitMs,
          label: "Fuera de tiempo"
        });
      }, responseLimitMs);

      onStimulus?.(index);
    },
    [onStimulus, responseLimitMs, scheduleTimer, updatePhase]
  );

  const startAttempt = useCallback(
    (index: number) => {
      if (!runningRef.current) {
        return;
      }

      activeAttemptRef.current = index;
      awaitingResponseRef.current = false;
      setCountdownStage(COUNTDOWN_STEPS);
      setAttempt(index);
      updatePhase("countdown");

      for (let step = 1; step <= COUNTDOWN_STEPS; step += 1) {
        scheduleTimer(() => {
          setCountdownStage(COUNTDOWN_STEPS - step);
        }, step * 1000);
      }

      scheduleTimer(() => {
        updatePhase("waiting");
        const waitMs = randomBetween(waitMin, waitMax);
        scheduleTimer(() => {
          startStimulus(index);
        }, waitMs);
      }, COUNTDOWN_DURATION_MS);
    },
    [scheduleTimer, startStimulus, updatePhase, waitMax, waitMin]
  );

  const completeAttempt = useCallback(
    (result: ReactionAttemptResult) => {
      awaitingResponseRef.current = false;
      if (responseTimerRef.current) {
        removeTimer(responseTimerRef.current);
        responseTimerRef.current = null;
      }
      startTimestampRef.current = null;
      resultsRef.current = [...resultsRef.current, result];
      setLastResult(result);
      onAttemptRecorded?.(result);

      if (result.attempt >= totalAttempts) {
        finishGame();
      } else {
        startAttemptRef.current?.(result.attempt + 1);
      }
    },
    [finishGame, onAttemptRecorded, removeTimer, totalAttempts]
  );

  useEffect(() => {
    startAttemptRef.current = startAttempt;
  }, [startAttempt]);

  useEffect(() => {
    completeAttemptRef.current = completeAttempt;
  }, [completeAttempt]);

  const registerResponse = useCallback(
    ({ success, label, timeMsOverride }: RegisterResponseOptions) => {
      if (!awaitingResponseRef.current) {
        return;
      }
      const attemptIdx = activeAttemptRef.current;
      const startedAt = startTimestampRef.current ?? performance.now();
      const elapsed = Math.max(0, Math.round(performance.now() - startedAt));
      const safeTime = success ? Math.min(responseLimitMs, elapsed) : timeMsOverride ?? responseLimitMs;

      completeAttempt({ attempt: attemptIdx, success, timeMs: safeTime, label });
    },
    [completeAttempt, responseLimitMs]
  );

  useEffect(() => {
    runningRef.current = running;
    if (!running) {
      clearTimers();
      awaitingResponseRef.current = false;
      activeAttemptRef.current = 0;
      startTimestampRef.current = null;
      if (phaseRef.current !== "finished") {
        updatePhase("idle");
        setAttempt(0);
        setCountdownStage(0);
        setLastResult(null);
        setSummary(null);
        resultsRef.current = [];
      }
      return;
    }

    resultsRef.current = [];
    setSummary(null);
    setLastResult(null);
    setCountdownStage(COUNTDOWN_STEPS);
    setAttempt(1);
    updatePhase("countdown");
    startAttempt(1);

    return () => {
      runningRef.current = false;
      clearTimers();
    };
  }, [clearTimers, running, startAttempt, updatePhase]);

  return {
    attempt,
    totalAttempts,
    phase,
    countdownStage,
    lastResult,
    summary,
    awaitingResponse: awaitingResponseRef.current,
    registerResponse
  };
}
