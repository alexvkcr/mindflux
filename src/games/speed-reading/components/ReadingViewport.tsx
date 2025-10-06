import styles from './ReadingViewport.module.scss';

export interface ReadingViewportProps {
  line: string;
}

export function ReadingViewport({ line }: ReadingViewportProps) {
  return (
    <div className={styles.viewport} data-testid="reading-viewport">
      <div
        key={line}
        aria-live="polite"
        className={styles.line}
        data-testid="reading-viewport-line"
      >
        {line}
      </div>
    </div>
  );
}
