"use client";

import { useRef } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const PALETTE = [
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4",
  "#0ea5e9", "#3b82f6", "#64748b", "#78716c",
];

const COLUMNS = 8;

interface Props {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: Props) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = -1;
    if (e.key === "ArrowRight") next = index + 1;
    else if (e.key === "ArrowLeft") next = index - 1;
    else if (e.key === "ArrowDown") next = index + COLUMNS;
    else if (e.key === "ArrowUp") next = index - COLUMNS;
    if (next < 0 || next >= PALETTE.length) return;
    e.preventDefault();
    buttonRefs.current[next]?.focus();
  }

  return (
    <div
      role="listbox"
      aria-label="Cores disponíveis"
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}
    >
      {PALETTE.map((c, index) => (
        <button
          key={c}
          ref={(el) => {
            buttonRefs.current[index] = el;
          }}
          type="button"
          role="option"
          aria-selected={value === c}
          aria-label={`Cor ${c}`}
          onClick={() => onChange(c)}
          onKeyDown={(e) => onKeyDown(e, index)}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === c && "ring-2 ring-ring",
          )}
          style={{ backgroundColor: c }}
        >
          {value === c && <Check className="h-4 w-4 text-white" />}
        </button>
      ))}
    </div>
  );
}
