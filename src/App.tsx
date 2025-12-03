import { useState, useEffect } from "react";
import "./App.css";
import styles from "./App.module.scss";
import { Header } from "./components/Header";
import { ControlsBar, type ControlsState } from "./components/ControlsBar";
import { GameCanvas } from "./components/GameCanvas";
import { Info } from "./components/Info";
import { ControlsPortalProvider } from "./contexts/ControlsPortalContext";

function App() {
  // Atajo de teclado: espacio para alternar running
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setControls((prev) => ({ ...prev, running: !prev.running }));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const [controls, setControls] = useState<ControlsState>({
    category: "eyeMovement",
    game: "basic",
    level: 3,
    running: false,
    widthIdx: 3
  });

  const handleControlsChange = (next: Partial<ControlsState>) => {
    setControls((prev) => ({ ...prev, ...next }));
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
