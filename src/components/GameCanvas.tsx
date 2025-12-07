import { useRef, useState, useLayoutEffect, useCallback, useMemo, useEffect, type RefObject, type CSSProperties } from "react";
import type { ControlsState, BookKey } from "./ControlsBar";
import { EyeMovementBasic } from "../games/eye-movement/Basic";
import { EyeMovementIsoDistance } from "../games/eye-movement/IsoDistance";
import { FixedReading } from "../games/speed-reading/FixedReading";
import { ColumnReading } from "../games/speed-reading/ColumnReading/ColumnReading";
import { ReadingControls } from "../games/speed-reading/components/ReadingControls";
import { DobleNumero } from "../games/campo-visual/DobleNumero/DobleNumero";
import { ReflejoRapido } from "../games/reaction/ReflejoRapido";
import { CalculoRapido } from "../games/reaction/CalculoRapido";
import { ConcordanciaGramatical } from "../games/reaction/ConcordanciaGramatical";
import { SumaCadena } from "../games/math/SumaCadena";
import { CuentaMental } from "../games/math/CuentaMental";
import { ConteoHiLo } from "../games/math/ConteoHiLo";
import { useColumnHighlightEngine } from "../games/speed-reading/ColumnReading/hooks/useColumnHighlightEngine";
import { levelToWpm } from "../games/speed-reading/utils/wpm";
import { texts } from "../games/speed-reading/texts";
import { WIDTH_MAP, type WidthIndex } from "../games/speed-reading/utils/widthMap";
import columnStyles from "../games/speed-reading/ColumnReading/components/ReadingViewportColumns.module.scss";
import styles from "./GameCanvas.module.scss";
import { PrimaryButton } from "./ui/PrimaryButton";
import { t } from "../i18n";

const DEFAULT_WIDTH_IDX: WidthIndex = 3;
const ROW_GAP_PX_FALLBACK = 8;
const MAX_ROWS = 10;

function getRawText(book: BookKey): string {
  const fragments = texts[book] ?? [];
  return fragments.map((fragment) => fragment.text).join("\n\n");
}

interface ColumnReadingStageProps {
  controls: ControlsState;
  onChange: (next: Partial<ControlsState>) => void;
  onTimeout: () => void;
}

function ColumnReadingStage({ controls, onChange, onTimeout }: ColumnReadingStageProps) {
  const book = (controls.book ?? "quijote") as BookKey;
  const widthIdx = (controls.widthIdx as WidthIndex | undefined) ?? DEFAULT_WIDTH_IDX;
  const level = controls.level;
  const running = controls.running;

  const wpm = useMemo(() => levelToWpm(level), [level]);
  const charWidth = WIDTH_MAP[widthIdx];
  const rawText = useMemo(() => getRawText(book), [book]);

  const gameAreaRef = useRef<HTMLDivElement | null>(null);
  const [rows, setRows] = useState<number>(0);

  useEffect(() => {
    const host = gameAreaRef.current;
    if (!host) {
      setRows(0);
      return;
    }

    const computeRows = () => {
      const el = gameAreaRef.current;
      if (!el) {
        setRows(0);
        return;
      }

      const cs = getComputedStyle(el);
      const rowGap = Number.parseFloat(cs.getPropertyValue("--row-gap-px")) || ROW_GAP_PX_FALLBACK;
      const availableHeight = Math.max(0, el.clientHeight);

      const probeRow = document.createElement("div");
      probeRow.className = columnStyles.row;
      probeRow.style.visibility = "hidden";
      probeRow.style.position = "absolute";
      probeRow.style.inset = "0 auto auto 0";

      const makeCell = () => {
        const cell = document.createElement("p");
        cell.className = columnStyles.lineOff;
        cell.style.margin = "0";
        cell.style.width = `${charWidth}ch`;
        cell.style.whiteSpace = "nowrap";
        cell.textContent = "████████████████";
        return cell;
      };

      probeRow.appendChild(makeCell());
      probeRow.appendChild(makeCell());

      const wrapper = document.createElement("div");
      wrapper.className = columnStyles.columns;
      wrapper.style.visibility = "hidden";
      wrapper.style.position = "absolute";
      wrapper.style.inset = "0 auto auto 0";
      wrapper.appendChild(probeRow);

      el.appendChild(wrapper);
      const rowHeight = Math.ceil(probeRow.getBoundingClientRect().height);
      el.removeChild(wrapper);

      if (rowHeight <= 0) {
        setRows(0);
        return;
      }

      const denom = rowHeight + rowGap;
      let raw = Math.floor((availableHeight + rowGap) / denom);
      raw = Math.max(0, Math.min(MAX_ROWS, raw));

      const usedHeight = raw * rowHeight + Math.max(0, raw - 1) * rowGap;
      const safe = usedHeight > availableHeight ? raw - 1 : raw;

      setRows(Math.max(0, Math.min(MAX_ROWS, safe)));
    };

    const ro = new ResizeObserver(() => {
      computeRows();
    });

    ro.observe(host);
    computeRows();

    return () => {
      ro.disconnect();
    };
  }, [charWidth]);

  const {
    grid,
    highlightIdx,
    paused,
    play: playEngine,
    pause: pauseEngine,
    stop: stopEngine,
    reset
  } = useColumnHighlightEngine({
    text: rawText,
    charWidth,
    wpm,
    rows,
    running,
    onTimeout
  });

  useEffect(() => {
    reset({ text: rawText, charWidth, wpm, rows });
  }, [rawText, charWidth, wpm, rows, reset]);

  const handleControlsChange = useCallback(
    ({ book: nextBook, level: nextLevel, widthIdx: nextWidthIdx }: { book: BookKey; level: number; widthIdx: WidthIndex }) => {
      onChange({ book: nextBook, level: nextLevel, widthIdx: nextWidthIdx });
    },
    [onChange]
  );

  const handlePauseResume = () => {
    if (!running) {
      return;
    }
    if (paused) {
      playEngine();
    } else {
      pauseEngine();
    }
  };

  return (
    <div className={styles.columnShell}>
      <div className={styles.topBar}>
        <ReadingControls
          book={book}
          level={level}
          widthIdx={widthIdx}
          onChange={handleControlsChange}
        />
        <span className={styles.badge}>VELOCIDAD: {wpm} PALABRAS/MINUTO</span>
        <button
          type="button"
          className={styles.pauseBtn}
          onClick={handlePauseResume}
          disabled={!running}
        >
          {paused ? "CONTINUAR" : "PAUSA"}
        </button>
        <PrimaryButton
          className={styles.startBtn}
          onClick={() => {
            if (running) {
              stopEngine();
              onChange({ running: false });
            } else {
              stopEngine();
              onChange({ running: true });
            }
          }}
          aria-pressed={running}
        >
          {running ? t.controls.stop : t.controls.start}
        </PrimaryButton>
      </div>
      <div className={styles.columnBoard}>
        <ColumnReading
          grid={grid}
          rows={rows}
          charWidth={charWidth}
          highlightIdx={highlightIdx}
          gameAreaRef={gameAreaRef  as RefObject<HTMLDivElement>}
        />
      </div>
    </div>
  );
}

export function GameCanvas({
  controls,
  onChange
}: {
  controls: ControlsState;
  onChange: (next: Partial<ControlsState>) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [boardW, setBoardW] = useState(320);
  const [boardH, setBoardH] = useState(240);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const recompute = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;

    const LATERAL_PAD = 40;
    const BOTTOM_PAD = 20;
    const MAX_W = 700;
    const MIN_SIZE = 120;

    const rect = el.getBoundingClientRect();
    const docWidth = document.documentElement.clientWidth;

    const desiredW = docWidth - LATERAL_PAD;
    const desiredH = window.innerHeight - BOTTOM_PAD;

    const availW = Math.min(rect.width, docWidth) - LATERAL_PAD;
    const availH = Math.min(window.innerHeight - rect.top, desiredH);

    const w = Math.floor(
      clamp(
        Math.min(desiredW, MAX_W),
        MIN_SIZE,
        Math.min(availW, MAX_W)
      )
    );
    const h = Math.floor(clamp(desiredH, MIN_SIZE, availH));

    setBoardW(w);
    setBoardH(h);
  }, []);

  useLayoutEffect(() => {
    recompute();
    const ro = new ResizeObserver(recompute);
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener("resize", recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [recompute]);

  const handleTimeout = useCallback(() => {
    onChange({ running: false });
  }, [onChange]);

  const isColumnReadingGame = controls.category === "speedReading" && controls.game === "columnReading";
  const shouldGrowWithContent = controls.category === "visualField" && controls.game === "doubleNumber";
  const boardClassName = [
    styles.board,
    isColumnReadingGame ? styles.noFrame : "",
    shouldGrowWithContent ? styles.boardFlexible : ""
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const boardStyle: CSSProperties = { width: boardW };
  if (shouldGrowWithContent) {
    boardStyle.minHeight = boardH;
  } else {
    boardStyle.height = boardH;
  }

  return (
    <section ref={wrapRef} className={styles.wrap}>
      <div className={boardClassName} style={boardStyle}>
        {controls.category === "eyeMovement" && (
          controls.game === "basic" ? (
            <EyeMovementBasic
              level={controls.level}
              running={controls.running}
              boardW={boardW}
              boardH={boardH}
              onTimeout={handleTimeout}
            />
          ) : controls.game === "isoDistance" ? (
            <EyeMovementIsoDistance
              distance={controls.distance ?? 3}
              level={controls.level}
              running={controls.running}
              boardW={boardW}
              boardH={boardH}
              onTimeout={handleTimeout}
            />
          ) : null
        )}

        {controls.category === "speedReading" && controls.game === "fixedReading" && (
          <FixedReading
            book={controls.book ?? "quijote"}
            level={controls.level}
            running={controls.running}
            boardW={boardW}
            boardH={boardH}
            onTimeout={handleTimeout}
          />
        )}

        {controls.category === "speedReading" && controls.game === "columnReading" && (
          <ColumnReadingStage controls={controls} onChange={onChange} onTimeout={handleTimeout} />
        )}

        {controls.category === "visualField" && controls.game === "doubleNumber" && (
          <DobleNumero
            level={controls.level}
            running={controls.running}
            boardW={boardW}
            boardH={boardH}
            onTimeout={handleTimeout}
          />
        )}

        {controls.category === "math" && controls.game === "mathChain" && (
          <SumaCadena running={controls.running} boardW={boardW} boardH={boardH} onTimeout={handleTimeout} />
        )}

        {controls.category === "math" && controls.game === "mentalCount" && (
          <CuentaMental running={controls.running} boardW={boardW} boardH={boardH} onTimeout={handleTimeout} />
        )}

        {controls.category === "math" && controls.game === "hiLoCount" && (
          <ConteoHiLo running={controls.running} boardW={boardW} boardH={boardH} onTimeout={handleTimeout} />
        )}

        {controls.category === "reactionTime" && controls.game === "quickReflex" && (
          <ReflejoRapido running={controls.running} boardW={boardW} boardH={boardH} onTimeout={handleTimeout} />
        )}

        {controls.category === "reactionTime" && controls.game === "quickMath" && (
          <CalculoRapido running={controls.running} boardW={boardW} boardH={boardH} onTimeout={handleTimeout} />
        )}

        {controls.category === "reactionTime" && controls.game === "grammarMatch" && (
          <ConcordanciaGramatical running={controls.running} boardW={boardW} boardH={boardH} onTimeout={handleTimeout} />
        )}
      </div>
    </section>
  );
}











