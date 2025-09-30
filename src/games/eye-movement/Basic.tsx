import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./Basic.module.scss";

/**
 * Un circulo que salta a posiciones aleatorias cada X ms en funcion del nivel (1..9).
 * Nivel 1 = 1000ms, nivel 9 = 200ms (lineal).
 */
export function EyeMovementBasic({ level }: { level: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const size = 24; // diametro del circulo en px (simple, puede ser selector luego)

  const intervalMs = Math.max(200, 1000 - (level - 1) * 100);

  const moveRandom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const maxX = rect.width - size - 8; // margen de seguridad
    const maxY = rect.height - size - 8;

    const x = Math.max(4, Math.floor(Math.random() * (maxX - 4 + 1)));
    const y = Math.max(4, Math.floor(Math.random() * (maxY - 4 + 1)));
    setPos({ x, y });
  }, [size]);

  useEffect(() => {
    moveRandom(); // posicion inicial
    const id = setInterval(moveRandom, intervalMs);
    return () => clearInterval(id);
  }, [moveRandom, intervalMs]);

  useEffect(() => {
    const dot = dotRef.current;
    if (!dot) return;
    dot.style.left = `${pos.x}px`;
    dot.style.top = `${pos.y}px`;
  }, [pos]);

  return (
    <div ref={containerRef} className={styles.container}>
      <div aria-label="target-dot" ref={dotRef} className={styles.dot} />
    </div>
  );
}
