import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createReadingSession, type ReadingSnapshot } from "../readingSession";
import { buildLines } from "../utils/buildLines";
import { tokenize } from "../utils/tokenize";
import type { CharacterLine } from "../utils/characterReading";

interface Options {
  text: string;
  charWidth: number;
  intervalMs: number;
  durationMs: number;
  loop: boolean;
  running: boolean;
  onFinished: () => void;
  segments?: CharacterLine[];
}

export function useReadingSession({ text, charWidth, intervalMs, durationMs, loop, running, onFinished, segments }: Options) {
  const lines = useMemo(() => {
    if (segments) return segments.map(segment => segment.text);
    const words = tokenize(text);
    return words.length ? buildLines(words, charWidth) : [];
  }, [text, charWidth, segments]);
  const [snapshot, setSnapshot] = useState<ReadingSnapshot>({ index: 0, timeLeftMs: durationMs, status: "idle" });
  const sessionRef = useRef<ReturnType<typeof createReadingSession> | null>(null);
  const runningRef = useRef(running);
  const finishedRef = useRef(onFinished);
  const blocksRef = useRef({ lines, segments });
  const previousSegmentsRef = useRef(segments);
  const sessionWidth = segments ? 0 : charWidth;
  useLayoutEffect(() => {
    runningRef.current = running; finishedRef.current = onFinished;
    blocksRef.current = { lines, segments };
  }, [running, onFinished, lines, segments]);

  useEffect(() => {
    const session = createReadingSession({ blockCount: blocksRef.current.lines.length, intervalMs, durationMs, loop }, {
      now: () => performance.now(),
      setTimeout: (callback, delay) => window.setTimeout(callback, delay),
      clearTimeout: (id) => window.clearTimeout(id),
    }, setSnapshot, () => finishedRef.current());
    sessionRef.current = session;
    previousSegmentsRef.current = blocksRef.current.segments;
    setSnapshot(session.getSnapshot());
    if (runningRef.current) session.start();
    return () => { session.dispose(); sessionRef.current = null; };
  }, [text, sessionWidth, intervalMs, durationMs, loop]);

  // Resizing may wrap the paragraph differently. Keep the reader's place and timer state.
  useEffect(() => {
    const previous = previousSegmentsRef.current;
    const session = sessionRef.current;
    if (segments && previous && segments !== previous && session) {
      const start = previous[session.getSnapshot().index]?.start ?? 0;
      const index = segments.findIndex(segment => segment.start <= start && segment.end > start);
      session.updateBlocks(segments.length, index < 0 ? segments.length - 1 : index);
    }
    previousSegmentsRef.current = segments;
  }, [segments]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;
    if (running && ["idle", "finished"].includes(session.getSnapshot().status)) session.start();
    if (!running && session.getSnapshot().status !== "finished") session.stop();
  }, [running]);

  const start = useCallback(() => sessionRef.current?.start(), []);
  const pause = useCallback(() => sessionRef.current?.pause(), []);
  const resume = useCallback(() => sessionRef.current?.resume(), []);
  const stop = useCallback(() => sessionRef.current?.stop(), []);
  const seek = useCallback((index: number) => sessionRef.current?.seek(index), []);
  return { lines, snapshot, start, pause, resume, stop, seek };
}
