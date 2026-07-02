"use client";

import { useEffect, useId, type ReactNode } from "react";
import { CloseIcon } from "@/components/icons";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  size?: "medium" | "large";
};

export function Modal({ open, title, description, children, onClose, size = "medium" }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div aria-labelledby={titleId} aria-modal="true" className="modal-root" role="dialog">
      <button aria-label="Fechar janela" className="modal-backdrop" onClick={onClose} type="button" />
      <div className={`modal-content ${size === "large" ? "modal-large" : "modal-medium"}`}>
        <header className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-base font-semibold text-foreground" id={titleId}>{title}</h2>
            {description && <p className="mt-1 text-xs text-muted">{description}</p>}
          </div>
          <button aria-label="Fechar" className="icon-button -mr-1 -mt-1" onClick={onClose} type="button"><CloseIcon className="size-5" /></button>
        </header>
        <div className="min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
