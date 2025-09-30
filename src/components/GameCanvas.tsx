import type { ControlsState } from "./ControlsBar";
import { EyeMovementBasic } from "../games/eye-movement/Basic";
import styles from "./GameCanvas.module.scss";

export function GameCanvas({ controls }: { controls: ControlsState }) {
  return (
    <section className={styles.wrapper}>
      <div className={styles.canvas}>
        {controls.category === "eyeMovement" && controls.game === "basic" ? (
          <EyeMovementBasic level={controls.level} />
        ) : null}
      </div>
    </section>
  );
}
