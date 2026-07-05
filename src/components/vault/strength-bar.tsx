import { cn } from "@/lib/utils";
import type { Strength } from "@/lib/vault-crypto";

/** Barra de força de senha (4 segmentos) + rótulo. */
export function StrengthBar({ strength }: { strength: Strength }) {
  const color =
    strength.score >= 3 ? "bg-success" : strength.score === 2 ? "bg-amber-500" : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-1 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < strength.score ? color : "bg-muted")} />
        ))}
      </div>
      <span className="w-20 text-right text-xs font-medium text-muted-foreground">{strength.label}</span>
    </div>
  );
}
