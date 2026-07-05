"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Pencil, Trash2, Loader2, TrendingUp, TrendingDown, RefreshCw,
  ChevronDown, ChevronRight, ArrowDownCircle, ArrowUpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { InvestmentFormDialog, type InvestmentEdit } from "@/components/investments/investment-form-dialog";
import { InvestmentEntryDialog } from "@/components/investments/investment-entry-dialog";
import { UpdateValueDialog } from "@/components/investments/update-value-dialog";
import { deleteInvestment, deleteInvestmentEntry } from "@/app/(app)/investimentos/actions";
import { investmentTypeMeta } from "@/lib/investment-meta";
import { formatBRL, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface InvestmentEntry {
  id: string;
  amountCents: number;
  type: "deposit" | "withdraw";
  date: string;
  note: string | null;
}
export interface InvestmentRow {
  id: string;
  name: string;
  type: string;
  currentCents: number;
  investedCents: number;
  resultCents: number;
  updatedAt: string;
  entries: InvestmentEntry[];
}

function pctLabel(result: number, invested: number): string | null {
  if (invested <= 0) return null;
  return ((result / invested) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
}

export function InvestmentsView({ investments }: { investments: InvestmentRow[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InvestmentEdit | null>(null);
  const [entryInv, setEntryInv] = useState<InvestmentRow | null>(null);
  const [valueInv, setValueInv] = useState<InvestmentRow | null>(null);
  const [toDelete, setToDelete] = useState<InvestmentRow | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const totalInvested = investments.reduce((a, i) => a + i.investedCents, 0);
  const totalCurrent = investments.reduce((a, i) => a + i.currentCents, 0);
  const totalResult = totalCurrent - totalInvested;
  const totalPct = pctLabel(totalResult, totalInvested);

  async function confirmDelete() {
    if (!toDelete) return;
    setBusyId(toDelete.id);
    await deleteInvestment(toDelete.id);
    setBusyId(null);
    setToDelete(null);
    router.refresh();
  }
  async function removeEntry(id: string) {
    setBusyId(id);
    await deleteInvestmentEntry(id);
    setBusyId(null);
    router.refresh();
  }

  function renderInvestment(inv: InvestmentRow) {
    const meta = investmentTypeMeta(inv.type);
    const pct = pctLabel(inv.resultCents, inv.investedCents);
    const positive = inv.resultCents >= 0;
    const isOpen = expanded === inv.id;
    return (
      <Card key={inv.id}>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: meta.color }}>
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{inv.name}</p>
              <Badge className="mt-0.5 border-transparent" style={{ backgroundColor: meta.color + "22", color: meta.color }}>
                {meta.label}
              </Badge>
            </div>
            <div className="flex shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Editar"
                onClick={() => { setEditing({ id: inv.id, name: inv.name, type: inv.type, currentCents: inv.currentCents }); setFormOpen(true); }}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" aria-label="Excluir" onClick={() => setToDelete(inv)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/40 p-3 text-center">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Investido</p>
              <p className="tabular text-sm font-semibold">{formatBRL(inv.investedCents)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Atual</p>
              <p className="tabular text-sm font-semibold">{formatBRL(inv.currentCents)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Rendimento</p>
              <p className={cn("tabular flex items-center justify-center gap-0.5 text-sm font-semibold", positive ? "text-success" : "text-destructive")}>
                {positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {formatBRL(inv.resultCents)}
              </p>
              {pct && <p className={cn("tabular text-[11px]", positive ? "text-success" : "text-destructive")}>{positive && inv.resultCents > 0 ? "+" : ""}{pct}</p>}
            </div>
          </div>

          <div className="flex items-center gap-1 border-t pt-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEntryInv(inv)}>
              <Plus className="h-3.5 w-3.5" /> Movimentar
            </Button>
            <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setValueInv(inv)}>
              <RefreshCw className="h-3.5 w-3.5" /> Atualizar valor
            </Button>
            <Button variant="ghost" size="sm" className="ml-auto gap-1" onClick={() => setExpanded(isOpen ? null : inv.id)}>
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {inv.entries.length}
            </Button>
          </div>

          {isOpen && (
            <ul className="divide-y border-t">
              {inv.entries.length === 0 ? (
                <li className="py-2 text-sm text-muted-foreground">Nenhum aporte/resgate ainda.</li>
              ) : (
                inv.entries.map((e) => {
                  const isDeposit = e.type === "deposit";
                  return (
                    <li key={e.id} className="flex items-center gap-2 py-2 text-sm">
                      {isDeposit ? <ArrowDownCircle className="h-4 w-4 shrink-0 text-success" /> : <ArrowUpCircle className="h-4 w-4 shrink-0 text-destructive" />}
                      <span className="text-xs text-muted-foreground">{formatDate(e.date)}</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">{e.note ?? (isDeposit ? "Aporte" : "Resgate")}</span>
                      <span className={cn("tabular font-medium", isDeposit ? "text-success" : "text-destructive")}>
                        {isDeposit ? "+" : "−"}{formatBRL(e.amountCents)}
                      </span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" aria-label="Excluir" onClick={() => removeEntry(e.id)} disabled={busyId === e.id}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  );
                })
              )}
            </ul>
          )}
        </CardContent>
      </Card>
    );
  }

  const positiveTotal = totalResult >= 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Investimentos</h1>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Novo investimento
        </Button>
      </div>

      {investments.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total investido</CardTitle></CardHeader>
            <CardContent><div className="tabular text-2xl font-bold">{formatBRL(totalInvested)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Valor atual</CardTitle></CardHeader>
            <CardContent><div className="tabular text-2xl font-bold">{formatBRL(totalCurrent)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Rendimento</CardTitle></CardHeader>
            <CardContent>
              <div className={cn("tabular text-2xl font-bold", positiveTotal ? "text-success" : "text-destructive")}>{formatBRL(totalResult)}</div>
              {totalPct && <p className={cn("mt-1 text-xs", positiveTotal ? "text-success" : "text-destructive")}>{positiveTotal && totalResult > 0 ? "+" : ""}{totalPct} sobre o investido</p>}
            </CardContent>
          </Card>
        </div>
      )}

      {investments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <TrendingUp className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium">Nenhum investimento ainda</p>
            <p className="max-w-xs text-sm text-muted-foreground">Cadastre suas aplicações e acompanhe aportes, resgates e rentabilidade.</p>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-2"><Plus className="h-4 w-4" /> Novo investimento</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">{investments.map(renderInvestment)}</div>
      )}

      <InvestmentFormDialog key={editing?.id ?? "new-inv"} open={formOpen} onClose={() => setFormOpen(false)} investment={editing} />
      <InvestmentEntryDialog
        key={"entry-" + (entryInv?.id ?? "none")}
        open={!!entryInv}
        onClose={() => setEntryInv(null)}
        investmentId={entryInv?.id ?? null}
        investmentName={entryInv?.name ?? ""}
      />
      <UpdateValueDialog
        key={"val-" + (valueInv?.id ?? "none")}
        open={!!valueInv}
        onClose={() => setValueInv(null)}
        investmentId={valueInv?.id ?? null}
        investmentName={valueInv?.name ?? ""}
        currentCents={valueInv?.currentCents ?? 0}
      />

      <Dialog open={!!toDelete} onClose={() => setToDelete(null)} title="Excluir investimento" description="Remove o investimento e todos os aportes/resgates.">
        <p className="mb-4 text-sm">Excluir <strong>{toDelete?.name}</strong>?</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setToDelete(null)}>Cancelar</Button>
          <Button variant="destructive" onClick={confirmDelete} disabled={busyId === toDelete?.id}>
            {busyId === toDelete?.id && <Loader2 className="h-4 w-4 animate-spin" />} Excluir
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
