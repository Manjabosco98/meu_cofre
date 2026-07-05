"use client";

import { useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { PICKABLE_ICONS, Icon } from "@/components/lucide-icon";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (icon: string) => void;
}

const COLUMNS = 6;

export function IconPicker({ value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PICKABLE_ICONS;
    return PICKABLE_ICONS.filter((name) => name.replace(/-/g, " ").includes(q));
  }, [query]);

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = -1;
    if (e.key === "ArrowRight") next = index + 1;
    else if (e.key === "ArrowLeft") next = index - 1;
    else if (e.key === "ArrowDown") next = index + COLUMNS;
    else if (e.key === "ArrowUp") next = index - COLUMNS;
    if (next < 0 || next >= filtered.length) return;
    e.preventDefault();
    buttonRefs.current[next]?.focus();
  }

  return (
    <div className="rounded-md border">
      <div className="relative border-b">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar ícone..."
          aria-label="Buscar ícone"
          className="w-full bg-transparent py-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div
        role="listbox"
        aria-label="Ícones disponíveis"
        className="grid max-h-48 gap-1.5 overflow-y-auto p-2.5"
        style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}
      >
        {filtered.length === 0 ? (
          <p className="col-span-6 py-6 text-center text-sm text-muted-foreground">
            Nenhum ícone encontrado.
          </p>
        ) : (
          filtered.map((name, index) => (
            <button
              key={name}
              ref={(el) => {
                buttonRefs.current[index] = el;
              }}
              type="button"
              role="option"
              aria-selected={value === name}
              aria-label={name.replace(/-/g, " ")}
              title={name.replace(/-/g, " ")}
              onClick={() => onChange(name)}
              onKeyDown={(e) => onKeyDown(e, index)}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                value === name && "bg-primary/10 text-primary ring-2 ring-primary",
              )}
            >
              <Icon name={name} className="h-5 w-5" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
