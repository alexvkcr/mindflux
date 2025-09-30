import { useState } from "react";
import "./App.css";
import styles from "./App.module.scss";
import { Header } from "./components/Header";
import { ControlsBar } from "./components/ControlsBar";
import type { ControlsState } from "./components/ControlsBar";
import { GameCanvas } from "./components/GameCanvas";
import { Info } from "./components/Info";

function App() {
  const [controls, setControls] = useState<ControlsState>({
    category: "eyeMovement",
    game: "basic",
    level: 3
  });

  return (
    <div className={styles.app}>
      <Header />
      <ControlsBar state={controls} onChange={(next) => setControls({ ...controls, ...next })} />
      <GameCanvas controls={controls} />
      <Info />
    </div>
  );
}

export default App;
