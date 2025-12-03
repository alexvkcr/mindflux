import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ROUND_MS = 45000;

const SPEED_TABLE: Record<number, number> = {
  1: 1000,
  2: 800,
  3: 650,
  4: 520,
  5: 420,
  6: 340,
  7: 280,
  8: 240,
  9: 200
};

const INTERVAL_TABLE: Record<number, number> = {
  1: 1400,
  2: 1200,
  3: 1000,
  4: 900,
  5: 800,
  6: 650,
  7: 520,
  8: 420,
  9: 320
};

const VOWELS = "AEIOU";
const CONSONANTS = "BCDFGHJKLMNPQRSTVWXYZ";

type SymbolKind = "numbers" | "chars";

export type ModeVariant =
  | "numbers-2"
  | "numbers-4"
  | "chars-2"
  | "chars-4"
  | "binary-6";

type Phase = "show" | "blank";

type NumberPair = {
  left: string;
  right: string;
};

export interface EngineParams {
  speedLevel: number;
  difficultyLevel: number;
  intervalLevel: number;
  mode: ModeVariant;
  running: boolean;
  boardW: number;
  boardH: number;
  onRoundOver: () => void;
}

export interface EngineState {
  pair: NumberPair;
  phase: Phase;
  timeLeftMs: number;
  paused: boolean;
  pause: () => void;
  resume: () => void;
  reset: () => void;
}

function clampLevel(level: number): number {
  return Math.min(9, Math.max(1, Math.round(level)));
}

function randomDigit(): string {
  return Math.floor(Math.random() * 10).toString();
}

function randomLetter(): string {
  const base = Math.random() < 0.5 ? 65 : 97;
  const code = base + Math.floor(Math.random() * 26);
  return String.fromCharCode(code);
}

function randomLetterFromSet(pool: string): string {
  if (!pool) {
    return randomLetter();
  }
  const idx = Math.floor(Math.random() * pool.length);
  const char = pool[idx] ?? 'A';
  return Math.random() < 0.5 ? char.toLowerCase() : char;
}

function randomConsonant(): string {
  return randomLetterFromSet(CONSONANTS);
}

function randomVowelLetter(): string {
  return randomLetterFromSet(VOWELS);
}

function generateToken(mode: ModeVariant, kind: SymbolKind, position: number): string {
  if (mode === "binary-6") {
    return Math.random() < 0.5 ? "0" : "1";
  }
  if (kind === "numbers") {
    return randomDigit();
  }
  if (mode === "chars-4") {
    return position % 2 === 0 ? randomConsonant() : randomVowelLetter();
  }
  return randomLetter();
}

function getModeKind(mode: ModeVariant): SymbolKind {
  if (mode.startsWith("numbers") || mode.startsWith("binary")) {
    return "numbers";
  }
  return "chars";
}

function getSymbolsPerSide(mode: ModeVariant): number {
  const match = mode.match(/-(\d+)$/);
  if (!match) {
    return 1;
  }
  const total = Number(match[1]);
  if (!Number.isFinite(total) || total <= 0) {
    return 1;
  }
  return Math.max(1, Math.floor(total / 2));
}

function createSide(mode: ModeVariant): string {
  const count = getSymbolsPerSide(mode);
  const kind = getModeKind(mode);
  let result = "";
  for (let idx = 0; idx < count; idx += 1) {
    result += generateToken(mode, kind, idx);
  }
  return result;
}

function createPair(mode: ModeVariant): NumberPair {
  return {
    left: createSide(mode),
    right: createSide(mode)
  };
}



export function useDoubleNumberEngine({
  speedLevel,
  difficultyLevel: _difficultyLevel,
  intervalLevel,
  mode,
  running,
  boardW,
  boardH,
  onRoundOver
}: EngineParams): EngineState {
  const [pair, setPair] = useState<NumberPair>(() => createPair(mode));
  const [phase, setPhase] = useState<Phase>("blank");
  const [timeLeftMs, setTimeLeftMs] = useState(ROUND_MS);
  const [paused, setPaused] = useState(false);

  const speedRef = useRef(clampLevel(speedLevel));
  const modeRef = useRef<ModeVariant>(mode);
  const boardRef = useRef({ boardW, boardH });

  const phaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);
  const phaseStartRef = useRef<number | null>(null);
  const phaseDurationRef = useRef<number>(SPEED_TABLE[speedRef.current]);
  const remainingPhaseRef = useRef<number | null>(null);
  const timedOutRef = useRef(false);
  const prevRunningRef = useRef(running);

  const showDuration = useMemo(() => {
    const level = clampLevel(speedLevel);
    return SPEED_TABLE[level] ?? SPEED_TABLE[1];
  }, [speedLevel]);

  const intervalDuration = useMemo(() => {
    const level = clampLevel(intervalLevel);
    return INTERVAL_TABLE[level] ?? INTERVAL_TABLE[1];
  }, [intervalLevel]);

  const clearPhaseTimeout = useCallback(() => {
    if (phaseTimeoutRef.current !== null) {
      clearTimeout(phaseTimeoutRef.current);
      phaseTimeoutRef.current = null;
    }
  }, []);

  const stopClock = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTickRef.current = null;
  }, []);

  const stopAll = useCallback(() => {
    clearPhaseTimeout();
    stopClock();
  }, [clearPhaseTimeout, stopClock]);

  const handleRoundOver = useCallback(() => {
    if (timedOutRef.current) {
      return;
    }
    timedOutRef.current = true;
    stopAll();
    setPaused(true);
    setPhase("blank");
    onRoundOver();
  }, [onRoundOver, stopAll]);

  const schedulePhase = useCallback(
    (currentPhase: Phase) => {
      const baseDuration = currentPhase === "show" ? showDuration : intervalDuration;
      const pending = remainingPhaseRef.current ?? baseDuration;

      phaseDurationRef.current = baseDuration;
      remainingPhaseRef.current = null;
      phaseStartRef.current = performance.now();

      clearPhaseTimeout();
      phaseTimeoutRef.current = setTimeout(() => {
        phaseStartRef.current = null;
        remainingPhaseRef.current = null;

        if (currentPhase === "show") {
          setPhase("blank");
        } else {
          setPair(createPair(modeRef.current));
          setPhase("show");
        }
      }, pending);
    },
    [clearPhaseTimeout, showDuration, intervalDuration]
  );

  useEffect(() => {
    speedRef.current = clampLevel(speedLevel);
  }, [speedLevel]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    setPair(createPair(modeRef.current));
  }, [mode]);

  useEffect(() => {
    boardRef.current = { boardW, boardH };
  }, [boardW, boardH]);

  useEffect(() => {
    if (running && !prevRunningRef.current) {
      timedOutRef.current = false;
      setPaused(false);
      setTimeLeftMs(ROUND_MS);
      const initialPair = createPair(modeRef.current);
      setPair(initialPair);
      setPhase("show");
    }

    if (!running && prevRunningRef.current) {
      stopAll();
      setPaused(false);
      setPhase("blank");
      setTimeLeftMs(ROUND_MS);
      remainingPhaseRef.current = null;
      phaseStartRef.current = null;
    }

    prevRunningRef.current = running;
  }, [mode, running, stopAll]);

  useEffect(() => {
    if (!running || paused || timedOutRef.current) {
      clearPhaseTimeout();
      return;
    }

    schedulePhase(phase);

    return () => {
      clearPhaseTimeout();
    };
  }, [phase, running, paused, schedulePhase, clearPhaseTimeout]);

  useEffect(() => {
    if (!running || paused || timedOutRef.current) {
      stopClock();
      return;
    }

    const tick = (timestamp: number) => {
      const last = lastTickRef.current ?? timestamp;
      const delta = Math.min(timestamp - last, 200);
      lastTickRef.current = timestamp;

      if (phaseStartRef.current !== null) {
        const elapsed = timestamp - phaseStartRef.current;
        const remaining = Math.max(0, phaseDurationRef.current - elapsed);
        remainingPhaseRef.current = remaining;
      }

      let shouldEnd = false;
      setTimeLeftMs((prev) => {
        if (prev <= 0) {
          shouldEnd = true;
          return 0;
        }
        const next = Math.max(0, prev - delta);
        if (next === 0) {
          shouldEnd = true;
        }
        return next;
      });

      if (shouldEnd) {
        handleRoundOver();
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      stopClock();
    };
  }, [running, paused, handleRoundOver, stopClock]);

  const pause = useCallback(() => {
    if (paused || !running) {
      return;
    }
    clearPhaseTimeout();
    stopClock();

    if (phaseStartRef.current !== null) {
      const elapsed = performance.now() - phaseStartRef.current;
      const remaining = Math.max(0, phaseDurationRef.current - elapsed);
      remainingPhaseRef.current = remaining;
    }

    setPaused(true);
  }, [paused, running, clearPhaseTimeout, stopClock]);

  const resume = useCallback(() => {
    if (!paused || !running || timeLeftMs <= 0 || timedOutRef.current) {
      return;
    }
    lastTickRef.current = null;
    setPaused(false);
  }, [paused, running, timeLeftMs]);

  const reset = useCallback(() => {
    timedOutRef.current = false;
    setTimeLeftMs(ROUND_MS);
    const nextPair = createPair(modeRef.current);
    setPair(nextPair);
    setPaused(false);
    remainingPhaseRef.current = null;
    phaseStartRef.current = null;
    stopAll();
    setPhase(running ? "show" : "blank");
  }, [running, stopAll]);

  useEffect(() => {
    if (!running) {
      setPair(createPair(modeRef.current));
      setPhase("blank");
    }
  }, [mode, running]);

  return {
    pair,
    phase,
    timeLeftMs,
    paused,
    pause,
    resume,
    reset
  };
}
