"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, Landmark } from "lucide-react";
import { BankLogo } from "@/components/bank-logo";
import { BANKS, OTHER_BANK, bankBySlug } from "@/lib/banks";
import { cn } from "@/lib/utils";

interface Props {
  value: string; // slug | OTHER_BANK | ""
  onChange: (value: string) => void;
  id?: string;
}

export function BankSelect({ value, onChange, id }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = bankBySlug(value);
  const isOther = value === OTHER_BANK;

  function choose(v: string) {
    onChange(v);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-2 pr-9 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {selected ? (
          <>
            <BankLogo bank={selected.slug} className="h-6 w-6" />
            <span className="truncate">{selected.nome}</span>
          </>
        ) : isOther ? (
          <>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Landmark className="h-3.5 w-3.5" />
            </span>
            <span className="truncate">Outro…</span>
          </>
        ) : (
          <span className="truncate text-muted-foreground">Selecione o banco</span>
        )}
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-card p-1 shadow-md"
        >
          {BANKS.map((b) => (
            <li key={b.slug}>
              <button
                type="button"
                role="option"
                aria-selected={value === b.slug}
                onClick={() => choose(b.slug)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent",
                  value === b.slug && "bg-accent/60",
                )}
              >
                <BankLogo bank={b.slug} className="h-6 w-6" />
                <span className="truncate">{b.nome}</span>
                {value === b.slug && <Check className="ml-auto h-4 w-4 text-primary" />}
              </button>
            </li>
          ))}
          <li className="my-1 border-t" />
          <li>
            <button
              type="button"
              role="option"
              aria-selected={isOther}
              onClick={() => choose(OTHER_BANK)}
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent",
                isOther && "bg-accent/60",
              )}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Landmark className="h-3.5 w-3.5" />
              </span>
              <span className="truncate">Outro…</span>
              {isOther && <Check className="ml-auto h-4 w-4 text-primary" />}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
