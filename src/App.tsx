import { useState, useEffect } from "react";
import "./App.css";
import styles from "./App.module.scss";
import { Header } from "./components/Header";
import { ControlsBar } from "./components/ControlsBar";
import type { ControlsState } from "./components/ControlsBar";
import { GameCanvas } from "./components/GameCanvas";
import { Info } from "./components/Info";

function App() {
  // Atajo de teclado: espacio para alternar running
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setControls(prev => ({ ...prev, running: !prev.running }));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  const [controls, setControls] = useState<ControlsState>({
    category: "eyeMovement",
    game: "basic",
    level: 3,
    running: false
  });

  return (
    <div className={styles.app}>
      <Header />
      <ControlsBar state={controls} onChange={(next) => setControls({ ...controls, ...next })} />
      <GameCanvas 
        controls={controls} 
        onChange={(next) => setControls({ ...controls, ...next })}
      />
      <Info />
    </div>
  );
}

export default App;
