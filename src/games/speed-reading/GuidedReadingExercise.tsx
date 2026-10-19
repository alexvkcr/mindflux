import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { BookKey, ControlsState } from "../../components/ControlsBar";
import { ReadingControls } from "./components/ReadingControls";
import { usePagedReading } from "./hooks/usePagedReading";
import { useReadingSession } from "./hooks/useReadingSession";
import { READING_FONT } from "./hooks/useReadingLayout";
import { highlightedParts } from "./utils/characterReading";
import { levelToIntervalMs } from "./utils/pace";
import { tokenize } from "./utils/tokenize";
import { referenceWords, WIDTH_MAP, type WidthIndex } from "./utils/widthMap";
import styles from "./GuidedReadingExercise.module.scss";

interface Props {
  controls: ControlsState;
  text: string;
  book: BookKey;
  loading: boolean;
  onChange: (next: Partial<ControlsState>) => void;
  onTimeout: () => void;
}

export function GuidedReadingExercise({ controls, text, book, loading, onChange, onTimeout }: Props) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const requestedWidth = (controls.widthIdx && controls.widthIdx in WIDTH_MAP ? controls.widthIdx : 1) as WidthIndex;
  const requestedCycles = [1, 2, 3].includes(controls.readingLineCycles ?? 2) ? controls.readingLineCycles ?? 2 : 2;
  const level = Math.min(9, Math.max(1, Math.round(controls.level)));
  const layout = usePagedReading(text, requestedWidth, requestedCycles, open);
  const widthIdx = layout.selected?.widthIdx ?? requestedWidth;
  const lineCycles = layout.selected?.lineCycles ?? requestedCycles;
  const charWidth = WIDTH_MAP[widthIdx];
  const intervalMs = levelToIntervalMs(level);
  const { snapshot, start, stop, pause, resume, seek } = useReadingSession({ text, charWidth, intervalMs,
    durationMs: Infinity, loop: false, segments: layout.cycles,
    running: controls.running && layout.ready && !loading, onFinished: onTimeout });
  const paused = snapshot.status !== "running";
  const cycle = layout.cycles[snapshot.index];
  const pageCount = Math.max(1, Math.ceil(layout.lines.length / layout.rows));
  const pageIndex = Math.min(pageCount - 1, Math.floor((cycle?.line ?? 0) / layout.rows));
  const pageLines = layout.lines.slice(pageIndex * layout.rows, (pageIndex + 1) * layout.rows);
  const wordCount = useMemo(() => tokenize(text).length, [text]);
  const textSpeed = layout.cycles.length ? 60000 / intervalMs * wordCount / layout.cycles.length : 0;
  const close = useCallback(() => { stop(); setOpen(false); onChange({ running: false }); }, [stop, onChange]);
  const launch = () => {
    if (!layout.ready || loading) return;
    setOpen(true); start(); onChange({ running: true });
  };
  const togglePause = () => {
    if (snapshot.status === "finished" || snapshot.status === "idle") { start(); onChange({ running: true }); }
    else if (paused) resume();
    else pause();
  };
  const goToPage = (index: number) => {
    const line = layout.lines[Math.max(0, Math.min(pageCount - 1, index)) * layout.rows];
    if (!line) return;
    seek(line.cycleStart);
    if (!controls.running) onChange({ running: true });
  };

  useEffect(() => {
    if (layout.selected && (widthIdx !== requestedWidth || lineCycles !== requestedCycles)) {
      onChange({ widthIdx, readingLineCycles: lineCycles });
    }
  }, [layout.selected, widthIdx, lineCycles, requestedWidth, requestedCycles, onChange]);
  // Preserve the shared Space shortcut when this exercise is launched from the keyboard.
  useEffect(() => { if (controls.running && layout.ready && !loading) setOpen(true); }, [controls.running, layout.ready, loading]);

  useLayoutEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current!;
    const focus = document.activeElement;
    const scrollX = window.scrollX, scrollY = window.scrollY;
    const body = document.body, root = document.documentElement;
    const saved = { position: body.style.position, top: body.style.top, left: body.style.left, width: body.style.width, overflow: body.style.overflow };
    const overflow = root.style.overflow;
    Object.assign(body.style, { position: "fixed", top: `${-scrollY}px`, left: `${-scrollX}px`, width: "100%", overflow: "hidden" });
    root.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close(); Object.assign(body.style, saved); root.style.overflow = overflow;
      if (focus instanceof HTMLElement && focus.isConnected) focus.focus({ preventScroll: true });
      window.scrollTo(scrollX, scrollY);
    };
  }, [open]);

  return <section className={styles.setup} data-guided-setup>
    <ReadingControls book={book} level={level} widthIdx={widthIdx} disabled={controls.running || loading}
      customTextName={controls.customReadingText?.name} lineCycles={lineCycles} combinations={layout.combinations} onChange={onChange} />
    <p data-testid="reading-capacity">Capacidad de esta pantalla: {layout.capacity} caracteres por línea.
      Las combinaciones que no caben están desactivadas y se recalculan al redimensionar.</p>
    <p>Ritmo: {Math.round(60000 / intervalMs)} ciclos/min · Referencia: {Math.round(referenceWords(charWidth) * 60000 / intervalMs)} palabras/min
      · Texto: ≈ {Math.round(textSpeed)} palabras/min.</p>
    <button type="button" onClick={launch} disabled={loading || !layout.ready}>Arranque</button>
    {!layout.ready && <p role="status">No hay una combinación que permita mostrar las palabras completas en este espacio. Amplía la ventana o elige otro texto.</p>}
    <details><summary>Cómo funciona la lectura por páginas</summary>
      <p>El ancho de referencia agrupa palabras completas: no se parte ninguna palabra al resaltar ni entre líneas.
        Una palabra más larga que el ancho se lee entera en su propio ciclo. Cada línea tiene como máximo {lineCycles} ciclos
        y {charWidth * lineCycles} caracteres, incluidos los espacios. Cada ciclo permanece en una sola línea.</p>
      <p>El número de filas por página depende de la altura disponible. Al terminar la página, el ritmo continúa en la siguiente.
        Anterior y Siguiente cambian de página y conservan la pausa. Cerrar o pulsar Escape detiene la lectura.</p>
    </details>

    {createPortal(<dialog ref={dialogRef} className={styles.dialog} aria-labelledby="guided-reader-title"
      data-testid="guided-reader" onCancel={event => { event.preventDefault(); close(); }}
      onKeyDown={event => {
        if (event.code === "Space" && !(event.target instanceof Element && event.target.closest("button, input, select"))) {
          event.preventDefault(); event.stopPropagation(); togglePause();
        }
      }}>
      <div className={styles.shell} data-reading="guided" data-status={snapshot.status} data-index={snapshot.index} data-interval-ms={intervalMs}>
        <header className={styles.header}>
          <h2 id="guided-reader-title">Lectura guiada</h2>
          <span data-testid="reading-page">Página {pageIndex + 1}/{pageCount}</span>
          <button type="button" className={styles.close} aria-label="Cerrar lector y detener" onClick={close}>×</button>
        </header>
        <div ref={layout.bodyRef} className={styles.page} data-testid="reading-page-body">
          {layout.ready ? <article className={styles.document} style={{ fontFamily: READING_FONT }} data-guided-text
            data-line-cycles={lineCycles} data-cycle-size={charWidth} data-line-limit={charWidth * lineCycles}
            data-page={pageIndex} data-pages={pageCount} data-total-lines={layout.lines.length}
            data-active-start={snapshot.status === "finished" ? "" : cycle?.start ?? ""}
            data-active-end={snapshot.status === "finished" ? "" : cycle?.end ?? ""}>
            <p>{pageLines.map(line => {
              const parts = highlightedParts(line, snapshot.status === "finished" ? -1 : cycle?.start ?? -1,
                snapshot.status === "finished" ? -1 : cycle?.end ?? -1);
              return <span key={line.start} className={styles.line} data-guided-line data-start={line.start} data-end={line.end}>
                {parts.before}{parts.active && <strong>{parts.active}</strong>}{parts.after}
              </span>;
            })}</p>
          </article> : <p>No hay espacio suficiente. Amplía la ventana o cierra el lector para cambiar el texto.</p>}
        </div>
        <footer className={styles.footer}>
          <div className={styles.navigation}>
            <button type="button" onClick={() => goToPage(pageIndex - 1)} disabled={!layout.ready || pageIndex === 0}>Anterior</button>
            <button type="button" onClick={togglePause} disabled={!layout.ready} aria-pressed={paused}>
              {snapshot.status === "finished" ? "Reiniciar" : paused ? "Continuar" : "Pausa"}</button>
            <button type="button" onClick={() => goToPage(pageIndex + 1)} disabled={!layout.ready || pageIndex + 1 >= pageCount}>Siguiente</button>
          </div>
          <span data-testid="reading-time">{snapshot.status === "finished" ? "Lectura terminada" : `Ciclo: ${Math.min(snapshot.index + 1, layout.cycles.length)}/${layout.cycles.length}`}</span>
        </footer>
      </div>
    </dialog>, document.body)}
  </section>;
}
