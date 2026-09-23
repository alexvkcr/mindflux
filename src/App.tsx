import { useState, useEffect } from "react";
import "./App.css";
import styles from "./App.module.scss";
import { Header } from "./components/Header";
import { ControlsBar, type ControlsState } from "./components/ControlsBar";
import { GameCanvas } from "./components/GameCanvas";
import { Info } from "./components/Info";
import { ControlsPortalProvider } from "./contexts/ControlsPortalContext";

function App() {
  const [controls, setControls] = useState<ControlsState>({
    category: "eyeMovement",
    game: "basic",
    level: 3,
    running: false,
    widthIdx: 3
  });

  // Atajo de teclado: espacio para alternar running
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.code !== "Space" ||
        controls.category === "memory" ||
        e.defaultPrevented ||
        e.repeat ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey
      ) {
        return;
      }

      const target = e.target;
      if (
        target instanceof Element &&
        target.closest(
          "input, textarea, select, button, a[href], [contenteditable], [role='button'], [role='textbox'], [role='combobox'], [role='slider']"
        )
      ) {
        return;
      }

      e.preventDefault();
      setControls((prev) => ({ ...prev, running: !prev.running }));
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [controls.category]);

  const handleControlsChange = (next: Partial<ControlsState>) => {
    setControls((prev) => {
      const changesMemoryCategory =
        next.category !== undefined &&
        next.category !== prev.category &&
        (prev.category === "memory" || next.category === "memory");

      return {
        ...prev,
        ...next,
        ...(changesMemoryCategory ? { running: false } : {})
      };
    });
  };

  return (
    <ControlsPortalProvider>
      <div className={styles.app}>
        <Header />
        <ControlsBar state={controls} onChange={handleControlsChange} />
        <GameCanvas controls={controls} onChange={handleControlsChange} />
        <Info />
      </div>
    </ControlsPortalProvider>
  );
}

export default App;
