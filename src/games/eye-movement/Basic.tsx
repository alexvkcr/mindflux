import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./Basic.module.scss";
import { getIntervalMs } from "../utils/speed";

/**
 * Un circulo que salta a posiciones aleatorias cada X ms en funcion del nivel (1..9).
 * Nivel 1 = 1000ms, nivel 9 = 200ms (lineal).
 */
type Props = {
  level: number;
  running: boolean;
  boardW: number;
  boardH: number;
  onTimeout: () => void;
};

export function EyeMovementBasic({ 
  level, 
  running,
  boardW,
  boardH,
  onTimeout 
}: Props) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const size = 24; // diametro del circulo
  const margin = 8; // seguridad contra borde

  const intervalMs = getIntervalMs(level);

  const moveRandom = useCallback(() => {
    const maxX = Math.max(4, boardW - size - margin);
    const maxY = Math.max(4, boardH - size - margin);
    const x = Math.floor(Math.random() * maxX);
    const y = Math.floor(Math.random() * maxY);
    setPos({ x, y });
  }, [boardW, boardH]);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const killerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Efecto principal para intervalos y timeout
  useEffect(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    if (killerRef.current) { clearTimeout(killerRef.current); killerRef.current = null; }

    if (!running) return;

    // posicion inicial y primer salto inmediato
    moveRandom();

    tickRef.current = setInterval(moveRandom, intervalMs);
    killerRef.current = setTimeout(onTimeout, 30000);

    return () => {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      if (killerRef.current) { clearTimeout(killerRef.current); killerRef.current = null; }
    };
  }, [moveRandom, intervalMs, running, onTimeout]);

  // Control de pausa en background
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      } else if (!document.hidden && running && !tickRef.current) {
        tickRef.current = setInterval(moveRandom, intervalMs);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [running, intervalMs, moveRandom]);

  // Reposicionar cuando cambien las dimensiones
  useEffect(() => {
    if (running) {
      moveRandom();
    }
  }, [boardW, boardH, running, moveRandom]);

  return (
    <div className={styles.container}>
      {running && (
        <div 
          aria-label="target-circle" 
          className={styles.circle}
          style={{
            left: pos.x,
            top: pos.y,
            width: size,
            height: size
          }}
        />
      )}
    </div>
  );
}
