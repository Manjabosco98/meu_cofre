"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function PeriodToggle({ value }: { value: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(months: number) {
    const next = new URLSearchParams(params.toString());
    next.set("meses", String(months));
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-xs">
      {[6, 12].map((m) => (
        <button
          key={m}
          onClick={() => set(m)}
          className={cn(
            "rounded-md px-3 py-1 font-medium transition",
            value === m ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {m}m
        </button>
      ))}
    </div>
  );
}
