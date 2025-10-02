import { useRef, useState, useLayoutEffect, useCallback } from "react";
import type { ControlsState } from "./ControlsBar";
import { EyeMovementBasic } from "../games/eye-movement/Basic";
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

    const LATERAL_PAD = 40; // 20px a cada lado
    const BOTTOM_PAD = 20;
    const MAX_W = 700;
    const MIN_SIZE = 120;

    const rect = el.getBoundingClientRect();
    const docWidth = document.documentElement.clientWidth; // No incluye scrollbar

    // Usar clientWidth en vez de innerWidth para evitar incluir scrollbar
    const desiredW = docWidth - LATERAL_PAD;
    const desiredH = window.innerHeight - BOTTOM_PAD;

    // Asegurar que availW no cause scroll
    const availW = Math.min(rect.width, docWidth) - LATERAL_PAD;
    const availH = Math.min(window.innerHeight - rect.top, desiredH);

    const w = Math.floor(clamp(
      Math.min(desiredW, MAX_W),
      MIN_SIZE,
      Math.min(availW, MAX_W)
    ));
    const h = Math.floor(clamp(desiredH, MIN_SIZE, availH));

    setBoardW(w);
    setBoardH(h);
    
    console.debug('board', w, h, 'maxW:', MAX_W);
  }, []);

  useLayoutEffect(() => {
    recompute();
    const ro = new ResizeObserver(recompute);
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener('resize', recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', recompute);
    };
  }, [recompute]);

  return (
    <section ref={wrapRef} className={styles.wrap}>
      <div className={styles.board} style={{ width: boardW, height: boardH }}>
        {controls.category === "eyeMovement" && controls.game === "basic" ? (
          <EyeMovementBasic 
            level={controls.level} 
            running={controls.running}
            boardW={boardW}
            boardH={boardH}
            onTimeout={() => onChange({ running: false })}
          />
        ) : null}
      </div>
    </section>
  );
}
