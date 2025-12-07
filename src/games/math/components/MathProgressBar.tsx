import styles from "../MathGame.module.scss";

interface MathProgressBarProps {
  duration: number;
  runKey: number;
}

export function MathProgressBar({ duration, runKey }: MathProgressBarProps) {
  return (
    <div className={styles.progressTrack}>
      <div
        key={runKey}
        className={styles.progressFill}
        style={{ animationDuration: `${duration}ms` }}
      />
    </div>
  );
}
