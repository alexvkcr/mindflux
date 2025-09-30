import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Un círculo que salta a posiciones aleatorias cada X ms en función del nivel (1..9).
 * Nivel 1 = 1000ms, nivel 9 = 200ms (lineal).
 */
export function EyeMovementBasic({ level }: { level: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const size = 24; // diámetro del círculo en px (simple, puede ser selector luego)

  const intervalMs = Math.max(200, 1000 - (level - 1) * 100);

  const moveRandom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const maxX = rect.width - size - 8;  // margen de seguridad
    const maxY = rect.height - size - 8;

    const x = Math.max(4, Math.floor(Math.random() * (maxX - 4 + 1)));
    const y = Math.max(4, Math.floor(Math.random() * (maxY - 4 + 1)));
    setPos({ x, y });
  }, [size]);

  useEffect(() => {
    moveRandom(); // posición inicial
    const id = setInterval(moveRandom, intervalMs);
    return () => clearInterval(id);
  }, [moveRandom, intervalMs]);

  return (
    <div ref={containerRef} style={{ position: "absolute", inset: 0 }}>
      <div
        aria-label="target-dot"
        style={{
          position: "absolute",
          left: pos.x,
          top: pos.y,
          width: size,
          height: size,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 30% 30%, #5fd5ff 0%, #3aa9ff 40%, #1a6bff 100%)",
          boxShadow: "0 0 12px rgba(58,169,255,0.75)",
          transform: "translate3d(0,0,0)"
        }}
      />
    </div>
  );
}