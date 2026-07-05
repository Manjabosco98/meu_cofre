"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Wallet, Search } from "lucide-react";
import { NAV_ITEMS, NAV_GROUPS } from "@/components/nav-items";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/components/logout-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AppShellProps {
  userName: string;
  userEmail: string;
  children: React.ReactNode;
}

export function AppShell({ userName, userEmail, children }: AppShellProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const nav = (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
      {NAV_GROUPS.map((group) => (
        <div key={group}>
          <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {group}
          </p>
          <ul className="space-y-0.5">
            {NAV_ITEMS.filter((i) => i.group === group).map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <div className="flex h-16 items-center gap-2 border-b px-5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Wallet className="h-5 w-5" />
      </div>
      <span className="text-base font-semibold">Finanças</span>
    </div>
  );

  const userBox = (
    <div className="border-t p-3">
      <div className="mb-2 px-2">
        <p className="truncate text-sm font-medium">{userName}</p>
        <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
      </div>
      <LogoutButton />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-card print:hidden lg:flex">
        {brand}
        {nav}
        {userBox}
      </aside>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-40 print:hidden lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r bg-card">
            <div className="flex items-center justify-between">
              {brand}
              <Button variant="ghost" size="icon" className="mr-2" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            {nav}
            {userBox}
          </aside>
        </div>
      )}

      {/* Conteúdo */}
      <div className="print:pl-0 lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur print:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="relative hidden max-w-sm flex-1 sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              disabled
              placeholder="Buscar (em breve)…"
              className="h-9 w-full rounded-md border border-input bg-muted/40 pl-9 pr-3 text-sm placeholder:text-muted-foreground"
            />
          </div>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl p-4 print:max-w-none print:p-0 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
