export interface ReadingClock {
  now: () => number;
  setTimeout: (callback: () => void, delay: number) => number;
  clearTimeout: (id: number) => void;
}

export interface ReadingSnapshot {
  index: number;
  timeLeftMs: number;
  status: "idle" | "running" | "paused" | "finished";
}

interface Options {
  blockCount: number;
  intervalMs: number;
  durationMs: number;
  loop: boolean;
}

// A single clock owns both the block cadence and the session deadline.
export function createReadingSession(options: Options, clock: ReadingClock,
  onChange: (snapshot: ReadingSnapshot) => void, onFinished: () => void) {
  let snapshot: ReadingSnapshot = { index: 0, timeLeftMs: options.durationMs, status: "idle" };
  let blockLeftMs = options.intervalMs;
  let updatedAt = 0;
  let timer: number | undefined;
  let disposed = false;

  const clear = () => {
    if (timer !== undefined) clock.clearTimeout(timer);
    timer = undefined;
  };
  const emit = () => { if (!disposed) onChange({ ...snapshot }); };
  const finish = () => {
    clear();
    snapshot.status = "finished";
    emit();
    onFinished();
  };
  const synchronize = () => {
    const now = clock.now();
    const delta = Math.max(0, now - updatedAt);
    updatedAt = now;
    snapshot.timeLeftMs = Math.max(0, snapshot.timeLeftMs - delta);
    blockLeftMs -= delta;
    if (snapshot.timeLeftMs <= 0) {
      finish();
    } else if (blockLeftMs <= 0.001) {
      if (!options.loop && snapshot.index + 1 >= options.blockCount) {
        finish();
      } else {
        snapshot.index = (snapshot.index + 1) % options.blockCount;
        // Delayed browser callbacks must not skip blocks the reader has not seen.
        blockLeftMs = options.intervalMs;
      }
    }
  };
  const schedule = () => {
    clear();
    if (disposed || snapshot.status !== "running") return;
    timer = clock.setTimeout(() => {
      timer = undefined;
      if (disposed || snapshot.status !== "running") return;
      synchronize();
      if (snapshot.status !== "running") return;
      emit();
      schedule();
    }, Math.max(1, Math.min(100, blockLeftMs, snapshot.timeLeftMs)));
  };

  return {
    getSnapshot: () => ({ ...snapshot }),
    seek(index: number) {
      if (disposed || options.blockCount === 0) return;
      clear();
      snapshot.index = Math.max(0, Math.min(index, options.blockCount - 1));
      if (snapshot.status !== "running") snapshot.status = "paused";
      blockLeftMs = options.intervalMs; updatedAt = clock.now();
      emit(); schedule();
    },
    updateBlocks(blockCount: number, index: number) {
      if (disposed) return;
      options.blockCount = blockCount;
      snapshot.index = Math.max(0, Math.min(index, blockCount - 1));
      emit();
    },
    start() {
      if (disposed) return;
      clear();
      snapshot = { index: 0, timeLeftMs: options.durationMs, status: "running" };
      blockLeftMs = options.intervalMs;
      updatedAt = clock.now();
      if (options.blockCount === 0) { finish(); return; }
      emit();
      schedule();
    },
    pause() {
      if (disposed || snapshot.status !== "running") return;
      synchronize();
      if (snapshot.status !== "running") return;
      clear();
      snapshot.status = "paused";
      emit();
    },
    resume() {
      if (disposed || snapshot.status !== "paused") return;
      snapshot.status = "running";
      updatedAt = clock.now();
      emit();
      schedule();
    },
    stop() {
      if (disposed) return;
      clear();
      snapshot = { index: 0, timeLeftMs: options.durationMs, status: "idle" };
      blockLeftMs = options.intervalMs;
      emit();
    },
    dispose() { disposed = true; clear(); },
  };
}
