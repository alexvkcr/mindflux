import { createPortal } from "react-dom";
import { useEffect, type ReactNode } from "react";
import styles from "./Modal.module.scss";
import { PrimaryButton } from "./PrimaryButton";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ open, title, children, onClose }: ModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={title}>
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
        </header>
        <div className={styles.content}>{children}</div>
        <div className={styles.actions}>
          <PrimaryButton className={styles.closeButton} onClick={onClose}>
            Cerrar
          </PrimaryButton>
        </div>
      </div>
    </div>,
    document.body
  );
}
