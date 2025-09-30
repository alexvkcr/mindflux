import { useState } from "react";
import "./App.css";
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
    <div
      style={{
        minHeight: "100dvh",
        color: "white",
        background: "radial-gradient(1200px 600px at 50% -10%, #1a1a22 0%, #0b0b0f 60%, #050507 100%)",
        overflowX: "hidden" // sin scroll lateral
      }}
    >
      <Header />
      <ControlsBar state={controls} onChange={(next) => setControls({ ...controls, ...next })} />
      <GameCanvas controls={controls} />
      <Info />
    </div>
  );
}

export default App;
