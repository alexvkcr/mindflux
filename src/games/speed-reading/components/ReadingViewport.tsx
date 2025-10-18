import styles from "./ReadingViewport.module.scss";

export interface ReadingViewportProps {
  line: string;
  charWidth: number;
}

export function ReadingViewport({ line, charWidth }: ReadingViewportProps) {
  return (
    <div className={styles.viewport} data-testid="reading-viewport" aria-live="polite">
      <div
        key={line}
        className={styles.line}
        data-testid="reading-viewport-line"
        style={{ width: `${charWidth}ch` }}
      >
        {line}
      </div>
    </div>
  );
}
