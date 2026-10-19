import { useRef, useState, useLayoutEffect, useCallback, type CSSProperties } from "react";
import type { ControlsState } from "./ControlsBar";
import { EyeMovementBasic } from "../games/eye-movement/Basic";
import { EyeMovementIsoDistance } from "../games/eye-movement/IsoDistance";
import { EyeMovementIsoRhythm } from "../games/eye-movement/IsoRhythm";
import { ReadingExercise } from "../games/speed-reading/ReadingExercise";
import { DobleNumero } from "../games/campo-visual/DobleNumero/DobleNumero";
import { SchulteTable } from "../games/campo-visual/SchulteTable/SchulteTable";
import { ReflejoRapido } from "../games/reaction/ReflejoRapido";
import { CalculoRapido } from "../games/reaction/CalculoRapido";
import { ConcordanciaGramatical } from "../games/reaction/ConcordanciaGramatical";
import { SumaCadena } from "../games/math/SumaCadena";
import { CuentaMental } from "../games/math/CuentaMental";
import { ConteoHiLo, ConteoHiLoConCartas } from "../games/math/ConteoHiLo";
import { MesaHiLo } from "../games/math/MesaHiLo";
import { MemoryGame } from "../games/memory/MemoryGame";
import styles from "./GameCanvas.module.scss";

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

  const isReadingGame = controls.category === "speedReading";
  const shouldGrowWithContent =
    controls.category === "visualField" ||
    controls.category === "math" ||
    controls.category === "reactionTime" ||
    controls.category === "memory" || isReadingGame;
  const boardClassName = [
    styles.board,
    isReadingGame ? styles.readingBoard : "",
    shouldGrowWithContent ? styles.boardFlexible : ""
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const boardStyle: CSSProperties = { width: isReadingGame ? "100%" : boardW };
  if (shouldGrowWithContent) {
    if (controls.category !== "memory" && !isReadingGame) {
      boardStyle.minHeight = boardH;
    }
  } else {
    boardStyle.height = boardH;
  }

  return (
    <section ref={wrapRef} className={`${styles.wrap} ${isReadingGame ? styles.readingWrap : ""}`}>
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
          ) : controls.game === "isoRhythm" ? (
            <EyeMovementIsoRhythm
              distance={controls.distance ?? 3}
              level={controls.level}
              running={controls.running}
              boardW={boardW}
              boardH={boardH}
              onTimeout={handleTimeout}
            />
          ) : null
        )}

        {isReadingGame && (
          <ReadingExercise key={controls.game} controls={controls} onChange={onChange} onTimeout={handleTimeout} />
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

        {controls.category === "visualField" && (controls.game === "schulteTable" || controls.game === "schulteContinuous") && (
          <SchulteTable
            key={controls.game}
            continuous={controls.game === "schulteContinuous"}
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

        {controls.category === "math" && controls.game === "hiLoCountCards" && (
          <ConteoHiLoConCartas running={controls.running} boardW={boardW} boardH={boardH} onTimeout={handleTimeout} />
        )}

        {controls.category === "math" && controls.game === "hiLoTable" && (
          <MesaHiLo running={controls.running} boardW={boardW} boardH={boardH} onTimeout={handleTimeout} />
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

        {controls.category === "memory" && controls.game === "digitMemory" && (
          <MemoryGame />
        )}
      </div>
    </section>
  );
}











