"use client";

import { PICKABLE_ICONS, Icon } from "@/components/lucide-icon";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (icon: string) => void;
}

export function IconPicker({ value, onChange }: Props) {
  return (
    <div className="grid max-h-40 grid-cols-8 gap-1.5 overflow-y-auto rounded-md border p-2">
      {PICKABLE_ICONS.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => onChange(name)}
          aria-label={name}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground",
            value === name && "bg-primary/10 text-primary ring-1 ring-primary",
          )}
        >
          <Icon name={name} className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
