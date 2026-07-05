"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  /**
   * Rodapé fixo (ex.: botões Cancelar/Salvar). Quando informado, o modal vira um
   * layout de 3 blocos (cabeçalho fixo / corpo com scroll interno / rodapé fixo),
   * útil para conteúdo longo que não deve estourar a viewport. Quando omitido,
   * mantém o comportamento antigo (modal inteiro rola como um bloco só).
   */
  footer?: React.ReactNode;
}

/** Modal leve e acessível (fecha no Esc e no clique fora). */
export function Dialog({ open, onClose, title, description, children, className, footer }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const closeButton = (
    <button
      onClick={onClose}
      aria-label="Fechar"
      className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <X className="h-5 w-5" />
    </button>
  );
  const headerText = (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50 animate-in fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative z-10 w-full rounded-t-2xl border bg-card shadow-lg animate-in slide-in-from-bottom-4 sm:max-w-md sm:rounded-lg",
          footer ? "flex max-h-[90vh] flex-col overflow-hidden" : "max-h-[90vh] overflow-y-auto p-6",
          className,
        )}
      >
        {footer ? (
          <>
            <div className="flex items-start justify-between gap-4 border-b px-6 py-5">
              {headerText}
              {closeButton}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
            <div className="border-t px-6 py-4">{footer}</div>
          </>
        ) : (
          <>
            <div className="mb-4 flex items-start justify-between gap-4">
              {headerText}
              {closeButton}
            </div>
            {children}
          </>
        )}
      </div>
    </div>
  );
}
