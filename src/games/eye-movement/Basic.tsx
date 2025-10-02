import { useCallback, useEffect, useState } from "react";
import styles from "./Basic.module.scss";

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

  const intervalMs = Math.max(200, 1000 - (level - 1) * 100);

  const moveRandom = useCallback(() => {
    const maxX = Math.max(4, boardW - size - margin);
    const maxY = Math.max(4, boardH - size - margin);
    const x = Math.floor(Math.random() * maxX);
    const y = Math.floor(Math.random() * maxY);
    setPos({ x, y });
  }, [boardW, boardH]);

  // Efecto principal para intervalos y timeout
  useEffect(() => {
    if (running) {
      moveRandom(); // posicion inicial
      const intervalId = setInterval(moveRandom, intervalMs);
      const timeoutId = setTimeout(onTimeout, 30000);

      return () => {
        clearInterval(intervalId);
        clearTimeout(timeoutId);
      };
    }
  }, [moveRandom, intervalMs, running, onTimeout]);

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
