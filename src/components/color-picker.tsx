"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const PALETTE = [
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4",
  "#0ea5e9", "#3b82f6", "#64748b", "#78716c",
];

interface Props {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={`Cor ${c}`}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition",
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
