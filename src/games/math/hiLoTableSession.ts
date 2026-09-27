import { closeCardBitmaps, loadCardBitmaps } from './cardBitmaps.ts';
import { createCardDealer, getCardImageSrc } from './hiLoCards.ts';
import { parseHiLoAnswer, planTableRounds, scoreTableRound } from './hiLoTable.ts';
import type { TableConfig, TableRound } from './hiLoTable.ts';
import { START_COUNTDOWN_SECONDS, BETWEEN_BLOCK_COUNTDOWN_SECONDS } from './utils.ts';

export type TablePhase = 'idle' | 'preparing' | 'loadError' | 'countdown' | 'show' | 'gap' | 'answer' | 'result' | 'revealed' | 'ended';
export interface TableView {
  phase: TablePhase;
  round: TableRound | null;
  roundNumber: number;
  bitmaps: Map<string, ImageBitmap>;
  countdown: number;
  loaded: number;
  total: number;
  loadError: boolean;
  feedback: string;
  resultAction: 'continue' | 'finish' | null;
}
export const initialTableView = (): TableView => ({ phase: 'idle', round: null, roundNumber: 0,
  bitmaps: new Map(), countdown: 0, loaded: 0, total: 0, loadError: false, feedback: '', resultAction: null });

interface Dependencies {
  draw: () => string;
  load: (cards: string[], signal: AbortSignal, progress: (loaded: number, total: number) => void) => Promise<Map<string, ImageBitmap>>;
  timeout: (callback: () => void, ms: number) => number;
  clearTimeout: (id: number) => void;
  frame: (callback: () => void) => number;
  cancelFrame: (id: number) => void;
}
interface PreparedTanda {
  rounds: TableRound[];
  controller: AbortController;
  bitmaps: Map<string, ImageBitmap>;
  ready: Promise<boolean>;
}

/** A session owns its timers, pending preparation and decoded resources. */
export function createTableSession(
  config: TableConfig,
  onChange: (view: TableView, synchronous: boolean) => void,
  onFinish: () => void,
  overrides: Partial<Dependencies> = {}
) {
  const deps: Dependencies = {
    draw: overrides.draw ?? createCardDealer(config.shoeSize),
    load: (cards, signal, progress) => loadCardBitmaps(cards, card => getCardImageSrc(card), signal, progress),
    timeout: (callback, ms) => window.setTimeout(callback, ms),
    clearTimeout: id => window.clearTimeout(id),
    frame: callback => window.requestAnimationFrame(callback),
    cancelFrame: id => window.cancelAnimationFrame(id),
    ...overrides
  };
  let view = initialTableView();
  let disposed = false;
  let started = false;
  let count = 0;
  let timer: number | null = null;
  let frame: number | null = null;
  let prepared: PreparedTanda | null = null;
  let countdownSeconds = START_COUNTDOWN_SECONDS;

  const emit = (patch: Partial<TableView>, synchronous = false) => {
    if (disposed) return;
    view = { ...view, ...patch };
    onChange(view, synchronous);
  };
  const clearTimers = () => {
    if (timer !== null) deps.clearTimeout(timer);
    if (frame !== null) deps.cancelFrame(frame);
    timer = frame = null;
  };
  const later = (callback: () => void, ms: number) => {
    timer = deps.timeout(() => { timer = null; if (!disposed) callback(); }, ms);
  };
  const release = () => {
    const previous = prepared;
    prepared = null;
    if (previous) { previous.controller.abort(); closeCardBitmaps(previous.bitmaps); }
  };
  const prepare = (rounds?: TableRound[]) => {
    release();
    const job: PreparedTanda = { rounds: rounds ?? planTableRounds(config, deps.draw),
      controller: new AbortController(), bitmaps: new Map(), ready: Promise.resolve(false) };
    prepared = job;
    emit({ loadError: false, loaded: 0, total: 0 });
    const cards = job.rounds.flatMap(round => round.flatMap(hand => hand.cards));
    job.ready = deps.load(cards, job.controller.signal, (loaded, total) => {
      if (prepared === job) emit({ loaded, total });
    }).then(bitmaps => {
      if (disposed || prepared !== job || job.controller.signal.aborted) { closeCardBitmaps(bitmaps); return false; }
      job.bitmaps = bitmaps;
      return true;
    }).catch(() => {
      if (prepared === job && !job.controller.signal.aborted) emit({ loadError: true });
      return false;
    });
    return job;
  };

  const present = (index: number) => {
    const job = prepared;
    if (disposed || !job) return;
    frame = deps.frame(() => {
      frame = null;
      if (disposed || prepared !== job) return;
      const round = job.rounds[index];
      count += scoreTableRound(round);
      // React commits and draws synchronously in this animation frame; exposure starts afterwards.
      emit({ phase: 'show', round, bitmaps: job.bitmaps, roundNumber: index + 1, feedback: '' }, true);
      later(() => {
        const last = index + 1 === job.rounds.length;
        emit({ phase: last ? 'answer' : 'gap', round: null, bitmaps: new Map() });
        if (last) prepare();
        else later(() => present(index + 1), config.gapMs);
      }, config.exposureMs);
    });
  };
  const beginCountdown = (seconds: number) => {
    let remaining = seconds;
    emit({ phase: 'countdown', countdown: remaining, roundNumber: 0 });
    const tick = () => {
      remaining--;
      if (!remaining) present(0);
      else { emit({ countdown: remaining }); later(tick, 1000); }
    };
    later(tick, 1000);
  };
  const awaitReady = async (seconds: number) => {
    clearTimers();
    countdownSeconds = seconds;
    emit({ phase: 'preparing', round: null, bitmaps: new Map() });
    const job = prepared ?? prepare();
    const ready = await job.ready;
    if (disposed || prepared !== job) return;
    if (!ready) emit({ phase: 'loadError' });
    else beginCountdown(seconds);
  };
  const finish = () => {
    clearTimers();
    emit({ phase: 'ended', round: null, bitmaps: new Map() });
    release();
    onFinish();
  };
  return {
    start() {
      if (started || disposed) return;
      started = true;
      void awaitReady(START_COUNTDOWN_SECONDS);
    },
    answer(draft: string, end: boolean): boolean {
      if (disposed || view.phase !== 'answer') return false;
      const guess = parseHiLoAnswer(draft);
      if (guess === null) { emit({ feedback: 'Introduce una cuenta entera válida.' }); return false; }
      emit({ feedback: guess === count ? `Correcto. Cuenta actual: ${count}.` : `Incorrecto. Tu respuesta: ${guess}. Cuenta correcta: ${count}.` });
      emit({ phase: 'result', round: null, bitmaps: new Map(), resultAction: end ? 'finish' : 'continue' });
      later(() => {
        if (end) finish();
        else void awaitReady(BETWEEN_BLOCK_COUNTDOWN_SECONDS);
      }, 5000);
      return true;
    },
    giveUp() {
      if (!disposed && view.phase === 'answer') emit({ phase: 'revealed', feedback: `La cuenta correcta es ${count}. Continúa desde esta cuenta.` });
    },
    continue() {
      if (!disposed && view.phase === 'revealed') void awaitReady(BETWEEN_BLOCK_COUNTDOWN_SECONDS);
    },
    retry() {
      if (disposed || !view.loadError) return;
      const waiting = view.phase === 'loadError';
      prepare(prepared?.rounds);
      if (waiting) void awaitReady(countdownSeconds);
    },
    dispose() { disposed = true; clearTimers(); release(); }
  };
}
