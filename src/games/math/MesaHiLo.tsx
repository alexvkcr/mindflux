import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useRegisterControlsPortal } from '../../contexts/controlsPortal';
import { Modal } from '../../components/ui/Modal';
import { MathProgressBar } from './components/MathProgressBar';
import { SHOE_OPTIONS } from './hiLoCards';
import { DEFAULT_TABLE_CONFIG, EXPOSURE_OPTIONS, GAP_OPTIONS, SEATS, layoutTable, normalizeTableCount, toggleSeat } from './hiLoTable';
import type { TableConfig } from './hiLoTable';
import { createTableSession, initialTableView } from './hiLoTableSession';
import type { TableView } from './hiLoTableSession';
import common from './MathGame.module.scss';
import styles from './MesaHiLo.module.scss';

function CountControl({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const commit = (next = normalizeTableCount(draft, value)) => { setDraft(String(next)); onChange(next); };
  return <label>{label}<span className={styles.stepper}>
    <button type="button" aria-label={`Reducir ${label.toLowerCase()}`} disabled={disabled || value === 1}
      onClick={() => commit(Math.max(1, normalizeTableCount(draft, value) - 1))}>−</button>
    <input aria-label={label} type="text" inputMode="numeric" role="spinbutton" aria-valuemin={1} aria-valuemax={10} aria-valuenow={value}
      value={draft} disabled={disabled} onChange={event => setDraft(event.target.value)} onBlur={() => commit()}
      onKeyDown={event => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault();
          commit(Math.min(10, Math.max(1, normalizeTableCount(draft, value) + (event.key === 'ArrowUp' ? 1 : -1))));
        }
      }} />
    <button type="button" aria-label={`Aumentar ${label.toLowerCase()}`} disabled={disabled || value === 10}
      onClick={() => commit(Math.min(10, normalizeTableCount(draft, value) + 1))}>+</button>
  </span></label>;
}

function TableCanvas({ view, config }: { view: TableView; config: TableConfig }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    const context = canvas.getContext('2d');
    if (!context) return;
    context.scale(ratio, ratio);
    if (!view.round || view.phase !== 'show') return;
    const placements = layoutTable(width, height, config.handSize, config.seats);
    for (const placement of placements) {
      const card = view.round.find(hand => hand.seat === placement.seat)?.cards[placement.index];
      const bitmap = card && view.bitmaps.get(card);
      if (!bitmap) continue;
      context.save();
      context.translate(placement.x, placement.y);
      context.rotate(placement.angle * Math.PI / 180);
      context.drawImage(bitmap, -placement.width / 2, -placement.height / 2, placement.width, placement.height);
      context.strokeStyle = '#22352e';
      context.lineWidth = 1;
      context.strokeRect(-placement.width / 2, -placement.height / 2, placement.width, placement.height);
      context.restore();
    }
  }, [config, view]);
  useLayoutEffect(draw, [draw]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);
  const description = view.round ? view.round.map(hand => `${SEATS.find(seat => seat.id === hand.seat)?.label}: ${hand.cards.join(', ')}`).join('. ') : 'Mesa sin cartas';
  return <canvas ref={canvasRef} role="img" aria-label={description} aria-hidden={view.phase !== 'show'} />;
}

export function MesaHiLo({ running, onTimeout }: { running: boolean; boardW: number; boardH: number; onTimeout: () => void }) {
  const [config, setConfig] = useState<TableConfig>(DEFAULT_TABLE_CONFIG);
  const [view, setView] = useState(initialTableView);
  const [answer, setAnswer] = useState('');
  const [explanation, setExplanation] = useState(false);
  const session = useRef<ReturnType<typeof createTableSession> | null>(null);
  const registerControls = useRegisterControlsPortal();

  useEffect(() => {
    if (!running) {
      setView(previous => previous.phase === 'ended' ? previous : initialTableView());
      return;
    }
    setAnswer('');
    const game = createTableSession(config, (next, synchronous) => {
      if (synchronous) flushSync(() => setView(next));
      else setView(next);
    }, onTimeout);
    session.current = game;
    game.start();
    return () => { game.dispose(); if (session.current === game) session.current = null; };
  }, [running, config, onTimeout]);

  useLayoutEffect(() => {
    const change = (patch: Partial<TableConfig>) => setConfig(previous => ({ ...previous, ...patch }));
    const seconds = (ms: number) => `${(ms / 1000).toLocaleString('es-ES')} s`;
    registerControls(<div className={styles.controls}>
      <CountControl label="Rondas por respuesta" value={config.rounds} disabled={running} onChange={rounds => change({ rounds })} />
      <CountControl label="Cartas por mano" value={config.handSize} disabled={running} onChange={handSize => change({ handSize })} />
      <label>Exposición<select value={config.exposureMs} disabled={running} onChange={event => change({ exposureMs: Number(event.target.value) })}>
        {EXPOSURE_OPTIONS.map(value => <option key={value} value={value}>{seconds(value)}</option>)}
      </select></label>
      <label>Pausa entre mesas<select value={config.gapMs} disabled={running} onChange={event => change({ gapMs: Number(event.target.value) })}>
        {GAP_OPTIONS.map(value => <option key={value} value={value}>{seconds(value)}</option>)}
      </select></label>
      <label>Número de mazos<select value={config.shoeSize} disabled={running} onChange={event => change({ shoeSize: Number(event.target.value) })}>
        {SHOE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select></label>
      <fieldset className={styles.players} disabled={running}><legend>Jugadores</legend>
        {SEATS.map(seat => <label key={seat.id}><input type="checkbox" checked={config.seats.includes(seat.id)}
          disabled={config.seats.length === 1 && config.seats.includes(seat.id)}
          onChange={() => setConfig(previous => ({ ...previous, seats: toggleSeat(previous.seats, seat.id) }))} />{seat.label}</label>)}
      </fieldset>
    </div>);
  }, [config, running, registerControls]);
  useEffect(() => () => registerControls(null), [registerControls]);

  const submit = (end: boolean) => { if (session.current?.answer(answer, end)) setAnswer(''); };
  const status = <p role="status">{view.loadError ? 'No se pudieron preparar las cartas.' :
    view.total > 0 && view.loaded === view.total ? 'Siguiente tanda lista' : `Preparando cartas… ${view.loaded}/${view.total}`}</p>;
  const retry = view.loadError && <button type="button" onClick={() => session.current?.retry()}>Reintentar</button>;
  return <div className={common.container}>
    <div className={common.topBar}>
      <div className={common.badges}>
        <span className={common.badge}>{config.seats.length} jugadores · {config.handSize} cartas por mano</span>
        <span className={common.badge}>{config.rounds} rondas por respuesta</span>
      </div>
      <button className={common.explanationBtn} type="button" onClick={() => setExplanation(true)}>Explicación</button>
    </div>
    <p className={common.instructions}>Observa las manos y lleva la cuenta Hi-Lo acumulada: 2–6 suman 1; 7–9 valen 0; 10, figuras y as restan 1.</p>
    <div className={styles.table} data-hi-lo-table data-phase={view.phase} data-round={view.roundNumber}>
      <TableCanvas view={view} config={config} />
      {view.phase !== 'show' && <div className={styles.overlay}>
        {view.phase === 'idle' && <p>Pulsa «Arranque» para comenzar.</p>}
        {(view.phase === 'preparing' || view.phase === 'loadError') && <>{status}{retry}</>}
        {view.phase === 'countdown' && <><p>{view.feedback ? 'Reanudando en' : 'Comenzando en'}</p><strong className={common.countdownNumber}>{view.countdown}</strong></>}
        {view.phase === 'gap' && <p>Pausa entre mesas</p>}
        {view.phase === 'answer' && <div className={common.inputRow}>
          <label htmlFor="table-count">Cuenta Hi-Lo acumulada</label>
          <input id="table-count" type="text" inputMode="text" autoComplete="off" spellCheck={false} placeholder="Cuenta Hi-Lo"
            value={answer} onChange={event => setAnswer(event.target.value)} />
          <div className={common.responseButtons}>
            <button type="button" onClick={() => session.current?.giveUp()}>No lo sé</button>
            <button type="button" onClick={() => submit(false)}>Lo sé y quiero continuar</button>
            <button type="button" onClick={() => submit(true)}>Lo sé y quiero terminar</button>
          </div>
          {status}{retry}
        </div>}
        {view.phase === 'result' && <><p className={styles.feedback} role="status">{view.feedback}</p>
          <p>{view.resultAction === 'finish' ? 'Fin de la partida en 5 segundos…' : 'Continuando en 5 segundos…'}</p></>}
        {view.phase === 'revealed' && <><p>{view.feedback}</p><button type="button" onClick={() => { setAnswer(''); session.current?.continue(); }}>Continuar</button>{status}{retry}</>}
        {view.phase === 'ended' && <><p>Partida terminada</p><p className={styles.feedback} role="status">{view.feedback}</p></>}
      </div>}
    </div>
    <p className={styles.status}>Ronda {view.roundNumber}/{config.rounds}</p>
    {view.phase === 'show' && <MathProgressBar duration={config.exposureMs} runKey={view.roundNumber} />}
    {view.phase === 'gap' && <MathProgressBar duration={config.gapMs} runKey={view.roundNumber} />}
    {view.feedback && view.phase !== 'revealed' && view.phase !== 'result' && view.phase !== 'ended' && <p className={styles.feedback} role="status">{view.feedback}</p>}
    <Modal open={explanation} title="Mesa Hi-Lo" onClose={() => setExplanation(false)}>
      <p>Memoriza la cuenta de toda la mesa. Cada ronda muestra manos nuevas de golpe; durante la pausa quedan ocultas.</p>
      <p>2–6: +1. 7–9: 0. Dieces, figuras y ases: −1. Responde después de la tanda manteniendo la cuenta acumulada de toda la partida.</p>
      <p>«No lo sé» revela la cuenta y permite continuar. Una respuesta incorrecta no cambia la cuenta real. El mazo se vuelve a barajar al agotarse.</p>
      <p>Las imágenes se preparan antes de comenzar. Hay 3 segundos de cuenta atrás inicial y 5 al continuar una tanda. Ajusta rondas, manos, jugadores y tiempos antes de arrancar. En móvil, la orientación horizontal facilita leer las manos largas.</p>
    </Modal>
  </div>;
}
