import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ControlsState } from "../../components/ControlsBar";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { ReadingControls } from "./components/ReadingControls";
import { ReadingViewport } from "./components/ReadingViewport";
import { GuidedReadingExercise } from "./GuidedReadingExercise";
import { ReadingViewportColumns } from "./ColumnReading/components/ReadingViewportColumns";
import { useReadingSession } from "./hooks/useReadingSession";
import { useReadingLayout, READING_FONT } from "./hooks/useReadingLayout";
import { texts } from "./texts";
import { WIDTH_MAP, referenceWords, type WidthIndex } from "./utils/widthMap";
import { levelToIntervalMs, readingMetrics } from "./utils/pace";
import { formatCountdown } from "./utils/formatCountdown";
import { readPlainTextFile } from "./utils/plainTextFile";
import styles from "./ReadingExercise.module.scss";

interface Props {
  controls: ControlsState;
  onChange: (next: Partial<ControlsState>) => void;
  onTimeout: () => void;
}

const number = (value: number) => Math.round(value).toLocaleString("es-ES");

export function ReadingExercise({ controls, onChange, onTimeout }: Props) {
  const [loadingText, setLoadingText] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const uploadRequest = useRef(0);
  useEffect(() => () => { uploadRequest.current++; }, []);
  const loadText = async (file: File) => {
    const request = ++uploadRequest.current;
    setLoadingText(true); setUploadError("");
    try {
      const customReadingText = await readPlainTextFile(file);
      if (request === uploadRequest.current) onChange({ customReadingText, book: "custom", running: false });
    } catch (error) {
      if (request === uploadRequest.current) setUploadError(error instanceof Error ? error.message : "No se ha podido leer el archivo.");
    } finally {
      if (request === uploadRequest.current) setLoadingText(false);
    }
  };
  const columnMode = controls.game === "columnReading";
  const fullTextMode = controls.game === "guidedReading";
  const book = controls.book === "custom" && !controls.customReadingText ? "quijote" : controls.book ?? "quijote";
  const level = Math.min(9, Math.max(1, Math.round(controls.level)));
  const widthIdx = (controls.widthIdx && controls.widthIdx in WIDTH_MAP ? controls.widthIdx : 1) as WidthIndex;
  const charWidth = WIDTH_MAP[widthIdx];
  const wordCount = referenceWords(charWidth);
  const intervalMs = levelToIntervalMs(level);
  const text = useMemo(() => book === "custom" ? controls.customReadingText!.text
    : texts[book].map(fragment => fragment.text).join("\n\n"), [book, controls.customReadingText]);
  const { lines, snapshot, start, pause, resume, stop } = useReadingSession({ text: fullTextMode ? "" : text, charWidth, intervalMs,
    durationMs: columnMode ? 45000 : 30000, loop: !columnMode,
    running: !fullTextMode && controls.running && !loadingText, onFinished: onTimeout });
  const { stageRef, fontSize, columns, rows, referenceWidthEm, columnGap, cueHeight } = useReadingLayout(lines, charWidth, columnMode);
  const metrics = useMemo(() => readingMetrics(intervalMs, wordCount, lines), [intervalMs, wordCount, lines]);
  const pageSize = rows * columns;
  const pageStart = Math.floor(snapshot.index / pageSize) * pageSize;
  const grid = lines.slice(pageStart, pageStart + pageSize);
  const paused = snapshot.status === "paused";
  const stageStyle = { fontFamily: READING_FONT, fontSize, fontWeight: 400, lineHeight: 1.7 } as CSSProperties;

  return (
    <div className={styles.exercise} data-reading={fullTextMode ? undefined : columnMode ? "columns" : "fixed"} data-status={snapshot.status}
      data-index={snapshot.index} data-interval-ms={intervalMs}>
      <h2>{fullTextMode ? "Lectura guiada por páginas" : columnMode ? "Lectura en columnas" : "Lectura fija"}</h2>
      {!fullTextMode && <ReadingControls book={book} level={level} widthIdx={widthIdx} disabled={controls.running || loadingText}
        customTextName={controls.customReadingText?.name}
        onChange={onChange} />}

      <div className={styles.upload} aria-busy={loadingText}>
        <label className={styles.uploadLabel}>
          <span>{loadingText ? "Comprobando TXT…" : "Cargar TXT propio"}</span>
          <input type="file" accept=".txt,text/plain" data-testid="reading-text-file" aria-describedby="reading-upload-help"
            disabled={controls.running || loadingText} onChange={event => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void loadText(file);
            }} />
        </label>
        <p id="reading-upload-help">Máximo 10 MB. UTF-8 o UTF-16 con BOM. Se comprueba todo el contenido y se lee solo en este navegador.</p>
        {controls.customReadingText && <div className={styles.loadedText}>
          <span data-testid="reading-loaded-file">{controls.customReadingText.name}</span>
          <button type="button" disabled={controls.running || loadingText} onClick={() => {
            setUploadError("");
            onChange({ customReadingText: undefined, ...(book === "custom" ? { book: "quijote" } : {}) });
          }}>Quitar TXT</button>
        </div>}
        {uploadError && <p role="alert" className={styles.uploadError}>{uploadError}</p>}
      </div>

      {fullTextMode ? <GuidedReadingExercise controls={controls} text={text} book={book} loading={loadingText} onChange={onChange} onTimeout={onTimeout} /> : <>
      <dl className={styles.metrics} aria-label="Ritmo y velocidad de lectura">
        <div><dt>Ritmo</dt><dd data-testid="reading-pace">{number(metrics.blocksPerMinute)} bloques/min</dd>
          <small>{number(intervalMs)} ms por bloque</small></div>
        <div><dt>Velocidad de referencia</dt><dd data-testid="reading-reference-speed">{number(metrics.referenceWpm)} palabras/min</dd>
          <small>{wordCount} palabras de referencia por bloque</small></div>
        <div><dt>Velocidad del texto</dt><dd data-testid="reading-text-speed">≈ {number(metrics.textWpm)} palabras/min</dd>
          <small>Media de palabras completas por bloque</small></div>
      </dl>

      <div className={styles.actions}>
        <PrimaryButton disabled={loadingText} onClick={() => {
          if (controls.running) { stop(); onChange({ running: false }); }
          else { start(); onChange({ running: true }); }
        }} aria-pressed={controls.running}>{controls.running ? "Alto" : "Arranque"}</PrimaryButton>
        <button type="button" onClick={() => paused ? resume() : pause()} disabled={!controls.running}
          aria-pressed={paused}>{paused ? "Continuar" : "Pausa"}</button>
        <span data-testid="reading-time">Tiempo restante: {formatCountdown(snapshot.timeLeftMs)}</span>
        {columnMode && <span>{columns} {columns === 1 ? "columna" : "columnas"} · {rows} filas</span>}
      </div>

      <p className={styles.hint} role="status">{snapshot.status === "finished" ? "Ejercicio terminado. Puedes volver a empezar."
        : paused ? "En pausa. Continuar conserva el tiempo que quedaba de este bloque."
          : columnMode ? "Sigue el bloque visible de izquierda a derecha y de arriba abajo. En pantallas estrechas se usa una columna."
            : "Mantén la mirada en el centro y lee cada bloque completo."}</p>

      <div className={styles.board}>
        <div ref={stageRef} className={`${styles.stage} ${columnMode ? styles.columnStage : styles.fixedStage}`} style={stageStyle}>
          {columnMode ? <ReadingViewportColumns grid={grid} rows={rows} columns={columns} columnGap={columnGap} referenceWidthEm={referenceWidthEm}
            cueHeight={cueHeight} hasNextPage={pageStart + pageSize < lines.length} reading={controls.running}
            highlightIdx={snapshot.index % pageSize} />
            : <ReadingViewport line={lines[snapshot.index] ?? ""} referenceWidthEm={referenceWidthEm} />}
        </div>
      </div>

      <details className={styles.info}>
        <summary>Cómo se calculan el ancho y la velocidad</summary>
        <p>El ancho se basa en repetir «como», una palabra de 4 letras, separando cada palabra con un espacio. Los espacios también cuentan.</p>
        <div className={styles.examples}>
          <figure><code>como como como</code><figcaption>3 palabras = 12 letras + 2 espacios = <strong>14 caracteres</strong>.</figcaption></figure>
          <figure><code>como como como como</code><figcaption>4 palabras = 16 letras + 3 espacios = <strong>19 caracteres</strong>.</figcaption></figure>
        </div>
        <p>Para N palabras de referencia, el ancho es <strong>5 × N − 1 caracteres</strong>. El texto se agrupa sin partir palabras:
          un bloque de 14 caracteres puede contener más o menos de 3 palabras reales. Una palabra que supere el límite se muestra completa.</p>
        <p><strong>Ritmo:</strong> cuántos bloques se presentan por minuto. El nivel elige el intervalo entre bloques, que es igual en todos los ejercicios
          y se mantiene al cambiar el ancho.</p>
        <p><strong>Velocidad de referencia = palabras de referencia por bloque × bloques por minuto.</strong> Con tu selección:
          {` ${wordCount} × ${number(metrics.blocksPerMinute)} ≈ ${number(metrics.referenceWpm)} palabras/min.`}</p>
        <p>La <strong>velocidad del texto</strong> usa la media de palabras reales por ciclo de la obra seleccionada, por eso es aproximada y puede
          diferir de la referencia. Ambas cifras describen la presentación del texto; no miden comprensión ni demuestran que lo hayas leído.</p>
        <p>La lectura fija dura 30 segundos y repite el texto si se agota. La lectura en columnas termina a los 45 segundos o al acabar el texto.
          La pausa detiene tanto la cuenta atrás como el avance de los bloques.</p>
      </details>
      </>}
    </div>
  );
}
