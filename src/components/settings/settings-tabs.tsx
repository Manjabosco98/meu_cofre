"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRound, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/configuracoes", label: "Perfil e preferências", icon: UserRound },
  { href: "/configuracoes/cofre", label: "Cofre de acessos", icon: KeyRound },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1">
      {TABS.map((t) => {
        const active = pathname === t.href;
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
