"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  Plus, Pencil, Trash2, Loader2, ChevronLeft, ChevronRight, PiggyBank, Copy, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/lucide-icon";
import { BudgetFormDialog, type BudgetEdit } from "@/components/budgets/budget-form-dialog";
import type { ComparisonPoint } from "@/components/budgets/budget-comparison-chart";
// Recharts lazy: só baixa quando o gráfico monta (fora do First Load JS).
const BudgetComparisonChart = dynamic(
  () => import("@/components/budgets/budget-comparison-chart").then((m) => m.BudgetComparisonChart),
  { ssr: false, loading: () => <div className="h-[240px] w-full animate-pulse rounded-md bg-muted" /> },
);
import { deleteBudget, copyFromPreviousMonth } from "@/app/(app)/orcamentos/actions";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CategoryOption } from "@/components/transactions/types";

export interface BudgetRow {
  id: string;
  categoryId: string;
  name: string;
  color: string;
  icon: string;
  limitCents: number;
  spentCents: number;
}

interface Props {
  monthFirst: string; // yyyy-mm-01
  rows: BudgetRow[];
  totalBudget: number;
  totalSpent: number;
  comparison: ComparisonPoint[];
  availableCategories: CategoryOption[];
}

function monthParam(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function BudgetsView({ monthFirst, rows, totalBudget, totalSpent, comparison, availableCategories }: Props) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetEdit | null>(null);
  const [toDelete, setToDelete] = useState<BudgetRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const monthDate = new Date(monthFirst + "T12:00:00");
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(monthDate);
  const prev = new Date(monthDate); prev.setMonth(prev.getMonth() - 1);
  const next = new Date(monthDate); next.setMonth(next.getMonth() + 1);

  function goMonth(d: Date) {
    router.push(`/orcamentos?mes=${monthParam(d)}`);
  }
  async function doCopy() {
    setCopyError(null);
    setBusy(true);
    const res = await copyFromPreviousMonth(monthFirst);
    setBusy(false);
    if (!res.ok) { setCopyError(res.error); return; }
    router.refresh();
  }
  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(true);
    await deleteBudget(toDelete.id);
    setBusy(false);
    setToDelete(null);
    router.refresh();
  }

  const totalPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Orçamentos</h1>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-2" disabled={availableCategories.length === 0}>
          <Plus className="h-4 w-4" /> Novo orçamento
        </Button>
      </div>

      {/* Navegação de mês */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => goMonth(prev)} aria-label="Mês anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[160px] text-center font-medium capitalize">{label}</span>
        <Button variant="outline" size="icon" onClick={() => goMonth(next)} aria-label="Próximo mês">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Resumo do mês */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Orçado</p>
          <p className="tabular text-xl font-bold">{formatBRL(totalBudget)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Gasto</p>
          <p className={cn("tabular text-xl font-bold", totalSpent > totalBudget && totalBudget > 0 && "text-destructive")}>{formatBRL(totalSpent)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Disponível</p>
          <p className={cn("tabular text-xl font-bold", totalBudget - totalSpent < 0 && "text-destructive")}>{formatBRL(totalBudget - totalSpent)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{totalPct}% consumido</p>
        </CardContent></Card>
      </div>

      {/* Lista de orçamentos */}
      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <PiggyBank className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium">Nenhum orçamento neste mês</p>
            <div className="flex gap-2">
              <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-2" disabled={availableCategories.length === 0}>
                <Plus className="h-4 w-4" /> Novo orçamento
              </Button>
              <Button variant="outline" onClick={doCopy} disabled={busy} className="gap-2">
                <Copy className="h-4 w-4" /> Copiar do mês anterior
              </Button>
            </div>
            {copyError && <p className="text-sm text-destructive">{copyError}</p>}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((b) => {
            const pct = b.limitCents > 0 ? (b.spentCents / b.limitCents) * 100 : 0;
            const over = b.spentCents > b.limitCents;
            const barColor = over ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-success";
            const remaining = b.limitCents - b.spentCents;
            return (
              <Card key={b.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: b.color }}>
                      <Icon name={b.icon} className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{b.name}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="tabular">{formatBRL(b.spentCents)}</span> de{" "}
                        <span className="tabular">{formatBRL(b.limitCents)}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      {over ? (
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-destructive">
                          <AlertTriangle className="h-3.5 w-3.5" /> estourou {formatBRL(-remaining)}
                        </span>
                      ) : (
                        <span className="tabular text-sm text-muted-foreground">restam {formatBRL(remaining)}</span>
                      )}
                    </div>
                    <div className="flex shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Editar"
                        onClick={() => { setEditing({ id: b.id, categoryName: b.name, limitCents: b.limitCents }); setFormOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" aria-label="Excluir" onClick={() => setToDelete(b)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", barColor)} style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Comparativo */}
      <Card>
        <CardHeader><CardTitle>Comparativo — orçado × gasto</CardTitle></CardHeader>
        <CardContent><BudgetComparisonChart data={comparison} /></CardContent>
      </Card>

      <BudgetFormDialog
        key={editing?.id ?? "new-budget"}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        month={monthFirst}
        editing={editing}
        availableCategories={availableCategories}
      />

      <Dialog open={!!toDelete} onClose={() => setToDelete(null)} title="Excluir orçamento">
        <p className="mb-4 text-sm">Excluir o orçamento de <strong>{toDelete?.name}</strong>?</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setToDelete(null)}>Cancelar</Button>
          <Button variant="destructive" onClick={confirmDelete} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Excluir
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
