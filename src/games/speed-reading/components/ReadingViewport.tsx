import styles from "./ReadingViewport.module.scss";

export interface ReadingViewportProps {
  line: string;
  referenceWidthEm: number;
}

export function ReadingViewport({ line, referenceWidthEm }: ReadingViewportProps) {
  return (
    <div className={styles.viewport} data-testid="reading-viewport" aria-label="Bloque de lectura">
      <div
        className={styles.line}
        data-testid="reading-viewport-line"
      >
        <span style={{ minWidth: `${referenceWidthEm}em` }}>{line}</span>
      </div>
    </div>
  );
}
