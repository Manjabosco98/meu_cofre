"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { AccountOption, CategoryOption } from "@/components/transactions/types";
import { cn } from "@/lib/utils";

interface Props {
  accounts: AccountOption[];
  categories: CategoryOption[];
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function FiltersBar({ accounts, categories }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const type = params.get("type") ?? "";
  const account = params.get("account") ?? "";
  const category = params.get("category") ?? "";
  const status = params.get("status") ?? "";

  function push(next: URLSearchParams) {
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }
  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    push(next);
  }
  function setPeriod(f: string, t: string) {
    const next = new URLSearchParams(params.toString());
    if (f) next.set("from", f);
    else next.delete("from");
    if (t) next.set("to", t);
    else next.delete("to");
    push(next);
  }
  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setParam("q", q);
  }
  function clearAll() {
    setQ("");
    router.push(pathname);
  }

  const now = new Date();
  const presets = [
    {
      label: "Este mês",
      f: ymd(new Date(now.getFullYear(), now.getMonth(), 1)),
      t: ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    },
    {
      label: "Mês passado",
      f: ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      t: ymd(new Date(now.getFullYear(), now.getMonth(), 0)),
    },
    {
      label: "Este ano",
      f: ymd(new Date(now.getFullYear(), 0, 1)),
      t: ymd(new Date(now.getFullYear(), 11, 31)),
    },
    { label: "Tudo", f: "", t: "" },
  ];

  const activePreset = presets.find((p) => p.f === from && p.t === to);
  const hasFilters = q || from || to || type || account || category || status;

  return (
    <div className="space-y-3">
      {/* Presets de período */}
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => setPeriod(p.f, p.t)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition",
              activePreset?.label === p.label
                ? "border-primary bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Linha de filtros */}
      <div className="flex flex-wrap items-end gap-2">
        <form onSubmit={submitSearch} className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar descrição…"
            className="pl-9"
          />
        </form>

        <Select value={type} onChange={(e) => setParam("type", e.target.value)} className="w-auto min-w-[130px]">
          <option value="">Todos os tipos</option>
          <option value="income">Receitas</option>
          <option value="expense">Despesas</option>
          <option value="transfer">Transferências</option>
        </Select>

        <Select value={account} onChange={(e) => setParam("account", e.target.value)} className="w-auto min-w-[130px]">
          <option value="">Todas as contas</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Select>

        <Select value={category} onChange={(e) => setParam("category", e.target.value)} className="w-auto min-w-[140px]">
          <option value="">Todas as categorias</option>
          {categories.filter((c) => !c.parent_id).map((p) => (
            <optgroup key={p.id} label={p.name}>
              <option value={p.id}>{p.name}</option>
              {categories.filter((c) => c.parent_id === p.id).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </optgroup>
          ))}
        </Select>

        <Select value={status} onChange={(e) => setParam("status", e.target.value)} className="w-auto min-w-[120px]">
          <option value="">Todos</option>
          <option value="cleared">Realizados</option>
          <option value="pending">Previstos</option>
        </Select>

        {(from || to) && (
          <div className="flex items-end gap-1">
            <Input type="date" value={from} onChange={(e) => setParam("from", e.target.value)} className="w-auto" />
            <span className="pb-2 text-muted-foreground">–</span>
            <Input type="date" value={to} onChange={(e) => setParam("to", e.target.value)} className="w-auto" />
          </div>
        )}

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="gap-1">
            <X className="h-4 w-4" /> Limpar
          </Button>
        )}
      </div>
    </div>
  );
}
