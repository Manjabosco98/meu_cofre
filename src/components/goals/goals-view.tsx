"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Pencil, Trash2, Loader2, Target, PiggyBank, Archive, ArchiveRestore,
  ChevronDown, ChevronRight, CheckCircle2, CalendarClock, Pause, Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { GoalFormDialog, type GoalEdit } from "@/components/goals/goal-form-dialog";
import { ContributionDialog } from "@/components/goals/contribution-dialog";
import { deleteGoal, setGoalArchived, setGoalStatus, deleteContribution } from "@/app/(app)/metas/actions";
import { formatBRL, formatDate } from "@/lib/format";
import { FREQUENCY_OPTIONS } from "@/lib/zod-schemas/goal";
import { cn } from "@/lib/utils";

export interface Contribution {
  id: string;
  amountCents: number;
  date: string;
  note: string | null;
  type: string;
}
export interface GoalRow {
  id: string;
  name: string;
  targetCents: number;
  currentCents: number;
  deadline: string | null;
  color: string;
  archived: boolean;
  achieved: boolean;
  monthsLeft: number | null;
  projectedLabel: string | null;
  monthlyForDeadline: number | null;
  contributions: Contribution[];
  recurringContributionCents: number;
  contributionFrequency: string | null;
  startDate: string;
  estimatedCompletionDate: string | null;
  displayStatus: "em_andamento" | "concluida" | "pausada" | "sem_previsao";
  accountId: string | null;
}

const STATUS_META: Record<string, { label: string; style: string }> = {
  em_andamento: { label: "Em andamento", style: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  concluida: { label: "Concluída", style: "border-primary/40 bg-primary/10 text-primary" },
  pausada: { label: "Pausada", style: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  sem_previsao: { label: "Sem previsão", style: "border-muted bg-muted/50 text-muted-foreground" },
};

const FREQ_MAP = Object.fromEntries(FREQUENCY_OPTIONS.map((f) => [f.value, f.label]));

export function GoalsView({ goals, accounts }: { goals: GoalRow[]; accounts: { id: string; name: string }[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GoalEdit | null>(null);
  const [contribGoal, setContribGoal] = useState<GoalRow | null>(null);
  const [toDelete, setToDelete] = useState<GoalRow | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const active = goals.filter((g) => !g.archived);
  const archived = goals.filter((g) => g.archived);

  async function toggleArchive(g: GoalRow) {
    setBusyId(g.id);
    await setGoalArchived(g.id, !g.archived);
    setBusyId(null);
    router.refresh();
  }
  async function togglePause(g: GoalRow) {
    setBusyId(g.id);
    await setGoalStatus(g.id, g.displayStatus === "pausada" ? "active" : "paused");
    setBusyId(null);
    router.refresh();
  }
  async function confirmDelete() {
    if (!toDelete) return;
    setBusyId(toDelete.id);
    await deleteGoal(toDelete.id);
    setBusyId(null);
    setToDelete(null);
    router.refresh();
  }
  async function removeContribution(id: string) {
    setBusyId(id);
    await deleteContribution(id);
    setBusyId(null);
    router.refresh();
  }

  function renderGoal(g: GoalRow) {
    const pct = g.targetCents > 0 ? Math.min(100, (g.currentCents / g.targetCents) * 100) : 0;
    const remaining = Math.max(0, g.targetCents - g.currentCents);
    const isOpen = expanded === g.id;
    const freqLabel = g.contributionFrequency ? FREQ_MAP[g.contributionFrequency] ?? g.contributionFrequency : null;
    const status = STATUS_META[g.displayStatus];

    return (
      <Card key={g.id} className={g.archived ? "opacity-60" : undefined}>
        <CardContent className="space-y-3 p-4">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: g.color }}>
              <Target className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium">{g.name}</p>
                <Badge className={status.style}>{status.label}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="tabular">{formatBRL(g.currentCents)}</span> de{" "}
                <span className="tabular">{formatBRL(g.targetCents)}</span>
              </p>
            </div>
          </div>

          {/* Progresso */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: g.color }} />
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">{Math.round(pct)}%</span>
            {g.achieved ? (
              <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Meta atingida</span>
            ) : (
              <span className="tabular text-muted-foreground">Faltam {formatBRL(remaining)}</span>
            )}
          </div>

          {/* Info de aporte recorrente + previsão */}
          {!g.achieved && (
            <div className="space-y-1 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {g.recurringContributionCents > 0 && freqLabel && (
                <p>
                  Aporte: <span className="font-medium text-foreground">{formatBRL(g.recurringContributionCents)}</span>/{freqLabel.toLowerCase()}
                </p>
              )}
              {g.projectedLabel && (
                <p>
                  Previsão: <span className="font-medium text-foreground">{g.projectedLabel}</span>
                  {g.monthsLeft != null && <> (~{g.monthsLeft} {g.monthsLeft === 1 ? "mês" : "meses"})</>}
                </p>
              )}
              {g.deadline && (
                <p className="flex items-center gap-1">
                  <CalendarClock className="h-3 w-3" /> Prazo: {formatDate(g.deadline)}
                  {g.monthlyForDeadline != null && (
                    <> · precisa de <span className="font-medium text-foreground">{formatBRL(g.monthlyForDeadline)}/{freqLabel?.toLowerCase() ?? "período"}</span></>
                  )}
                </p>
              )}
              {!g.projectedLabel && !g.deadline && (
                <p>Configure um aporte recorrente ou prazo para ver a previsão.</p>
              )}
            </div>
          )}

          {/* Ações */}
          <div className="flex items-center gap-1 border-t pt-2">
            {!g.achieved && (
              <Button size="sm" className="gap-1.5" onClick={() => setContribGoal(g)}>
                <PiggyBank className="h-3.5 w-3.5" /> Aportar
              </Button>
            )}
            {g.displayStatus !== "concluida" && (
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => togglePause(g)}>
                {g.displayStatus === "pausada" ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                {g.displayStatus === "pausada" ? "Reativar" : "Pausar"}
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto" aria-label="Editar"
              onClick={() => {
                setEditing({
                  id: g.id, name: g.name, targetCents: g.targetCents, deadline: g.deadline, color: g.color,
                  recurringContributionCents: g.recurringContributionCents, contributionFrequency: g.contributionFrequency,
                  startDate: g.startDate, accountId: g.accountId,
                });
                setFormOpen(true);
              }}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={g.archived ? "Restaurar" : "Arquivar"} onClick={() => toggleArchive(g)}>
              {g.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" aria-label="Excluir" onClick={() => setToDelete(g)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Histórico */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="ml-auto gap-1" onClick={() => setExpanded(isOpen ? null : g.id)}>
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {g.contributions.length} movimentação(ões)
            </Button>
          </div>

          {isOpen && (
            <ul className="divide-y border-t">
              {g.contributions.length === 0 ? (
                <li className="py-2 text-sm text-muted-foreground">Nenhuma movimentação ainda.</li>
              ) : (
                g.contributions.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 py-2 text-sm">
                    <span className="text-xs text-muted-foreground">{formatDate(c.date)}</span>
                    <Badge className="shrink-0 text-[10px] border-muted">
                      {c.type === "contribution" ? "Aporte" : c.type === "withdrawal" ? "Retirada" : c.type}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{c.note ?? ""}</span>
                    <span className={cn("tabular font-medium", c.amountCents < 0 ? "text-destructive" : "text-success")}>
                      {c.amountCents < 0 ? "−" : "+"}{formatBRL(Math.abs(c.amountCents))}
                    </span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" aria-label="Excluir" onClick={() => removeContribution(c.id)} disabled={busyId === c.id}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))
              )}
            </ul>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Metas</h1>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Nova meta
        </Button>
      </div>

      {active.length === 0 && archived.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Target className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium">Nenhuma meta criada ainda</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Crie uma caixinha para acompanhar seus objetivos financeiros, como reserva de emergência, viagem ou compra planejada.
            </p>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-2"><Plus className="h-4 w-4" /> Nova meta</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">{active.map(renderGoal)}</div>
      )}

      {archived.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Arquivadas</h2>
          <div className="grid gap-4 md:grid-cols-2">{archived.map(renderGoal)}</div>
        </div>
      )}

      <GoalFormDialog key={editing?.id ?? "new-goal"} open={formOpen} onClose={() => setFormOpen(false)} goal={editing} accounts={accounts} />
      <ContributionDialog
        key={contribGoal?.id ?? "none"}
        open={!!contribGoal}
        onClose={() => setContribGoal(null)}
        goalId={contribGoal?.id ?? null}
        goalName={contribGoal?.name ?? ""}
      />

      <Dialog open={!!toDelete} onClose={() => setToDelete(null)} title="Excluir meta" description="Remove a meta e todas as movimentações.">
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
