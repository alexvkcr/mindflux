import type { ControlsState } from "./ControlsBar";
import { EyeMovementBasic } from "../games/eye-movement/Basic";

export function GameCanvas({ controls }: { controls: ControlsState }) {
  return (
    <section style={{ display: "grid", justifyContent: "start", placeItems: "center", padding: "16px 20px" }}>
      <div
        style={{
          width: "min(500px, calc(100vw - 40px))",
          aspectRatio: "1 / 1",
          background: "linear-gradient(135deg, #111 0%, #1b1b1f 100%)",
          border: "1px solid #2a2a2f",
          borderRadius: 12,
          boxShadow: "0 0 0 1px #0d0d10 inset, 0 6px 30px rgba(0,0,0,0.35)",
          position: "relative",
          overflow: "hidden"
        }}
      >
        {controls.category === "eyeMovement" && controls.game === "basic" ? (
          <EyeMovementBasic level={controls.level} />
        ) : null}
      </div>
    </section>
  );
}