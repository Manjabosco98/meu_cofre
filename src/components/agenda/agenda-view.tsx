"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Check, Pencil, Trash2, Loader2, Repeat, CalendarClock, AlertTriangle, Power,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/lucide-icon";
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog";
import { RecurringFormDialog, type RecurringEditData } from "@/components/agenda/recurring-form-dialog";
import { formatBRL, formatDate } from "@/lib/format";
import { describeCadence, type Frequency } from "@/lib/recurrence";
import { cn } from "@/lib/utils";
import { setTransactionStatus, deleteTransaction } from "@/app/(app)/lancamentos/actions";
import { deleteRecurringRule, toggleRecurringActive } from "@/app/(app)/agenda/actions";
import type { AccountOption, CategoryOption, TagOption, TxEditData } from "@/components/transactions/types";

export interface PendingItem {
  id: string;
  kind: "income" | "expense";
  amount_cents: number;
  date: string;
  description: string;
  notes: string | null;
  account_id: string;
  account: { name: string; color: string; icon: string } | null;
  category_id: string | null;
  category: { name: string; color: string; icon: string } | null;
  tags: TagOption[];
  fromRecurring: boolean;
}

export interface RuleItem {
  id: string;
  type: "income" | "expense";
  description: string;
  amount_cents: number;
  account_id: string;
  category_id: string | null;
  accountName: string;
  frequency: Frequency;
  interval: number;
  next_run_date: string;
  end_date: string | null;
  occurrences: number | null;
  active: boolean;
}

interface Props {
  pending: PendingItem[];
  rules: RuleItem[];
  accounts: AccountOption[];
  categories: CategoryOption[];
  tags: TagOption[];
  todayStr: string;
}

export function AgendaView({ pending, rules, accounts, categories, tags, todayStr }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"previstos" | "recorrencias">("previstos");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [txEdit, setTxEdit] = useState<TxEditData | null>(null);
  const [txOpen, setTxOpen] = useState(false);
  const [txDelete, setTxDelete] = useState<PendingItem | null>(null);

  const [recEdit, setRecEdit] = useState<RecurringEditData | null>(null);
  const [recOpen, setRecOpen] = useState(false);
  const [recDelete, setRecDelete] = useState<RuleItem | null>(null);

  const overdue = pending.filter((p) => p.date.slice(0, 10) < todayStr);
  const dueToday = pending.filter((p) => p.date.slice(0, 10) === todayStr);
  const upcoming = pending.filter((p) => p.date.slice(0, 10) > todayStr);

  const toPay = pending.filter((p) => p.kind === "expense").reduce((a, p) => a + p.amount_cents, 0);
  const toReceive = pending.filter((p) => p.kind === "income").reduce((a, p) => a + p.amount_cents, 0);

  async function quitar(p: PendingItem) {
    setBusyId(p.id);
    await setTransactionStatus(p.id, "cleared");
    setBusyId(null);
    router.refresh();
  }
  function editPending(p: PendingItem) {
    setTxEdit({
      id: p.id, type: p.kind, amount_cents: p.amount_cents, date: p.date.slice(0, 10),
      description: p.description, account_id: p.account_id, to_account_id: null,
      category_id: p.category_id, tag_ids: p.tags.map((t) => t.id), notes: p.notes,
      status: "pending", transferGroupId: null, valorRealizado: null,
    });
    setTxOpen(true);
  }
  async function confirmDeleteTx() {
    if (!txDelete) return;
    setBusyId(txDelete.id);
    await deleteTransaction(txDelete.id);
    setBusyId(null);
    setTxDelete(null);
    router.refresh();
  }
  function editRule(r: RuleItem) {
    setRecEdit({
      id: r.id, type: r.type, description: r.description, amount_cents: r.amount_cents,
      account_id: r.account_id, category_id: r.category_id, frequency: r.frequency,
      interval: r.interval, start_date: r.next_run_date,
      end_type: r.end_date ? "date" : r.occurrences ? "count" : "never",
      end_date: r.end_date, occurrences: r.occurrences,
    });
    setRecOpen(true);
  }
  async function toggleRule(r: RuleItem) {
    setBusyId(r.id);
    await toggleRecurringActive(r.id, !r.active);
    setBusyId(null);
    router.refresh();
  }
  async function confirmDeleteRule() {
    if (!recDelete) return;
    setBusyId(recDelete.id);
    await deleteRecurringRule(recDelete.id);
    setBusyId(null);
    setRecDelete(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">A pagar / receber</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4">
          <p className="text-sm text-muted-foreground">A pagar</p>
          <p className="tabular text-xl font-bold text-destructive">{formatBRL(toPay)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-sm text-muted-foreground">A receber</p>
          <p className="tabular text-xl font-bold text-success">{formatBRL(toReceive)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Em atraso</p>
          <p className="tabular text-xl font-bold">{overdue.length}</p>
        </CardContent></Card>
      </div>

      {/* Tabs */}
      <div className="inline-flex rounded-lg border bg-muted/40 p-1">
        {([["previstos", "Previstos"], ["recorrencias", "Recorrências"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={cn("rounded-md px-4 py-1.5 text-sm font-medium transition", tab === k ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            {label}
          </button>
        ))}
      </div>

      {tab === "previstos" ? (
        pending.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <CalendarClock className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Nada previsto</p>
            <p className="text-sm text-muted-foreground">Crie lançamentos previstos ou recorrências.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-5">
            <PendingGroup title="Em atraso" items={overdue} overdue busyId={busyId} onQuitar={quitar} onEdit={editPending} onDelete={setTxDelete} />
            <PendingGroup title="Hoje" items={dueToday} busyId={busyId} onQuitar={quitar} onEdit={editPending} onDelete={setTxDelete} />
            <PendingGroup title="Próximos" items={upcoming} busyId={busyId} onQuitar={quitar} onEdit={editPending} onDelete={setTxDelete} />
          </div>
        )
      ) : (
        rules.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Repeat className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Nenhuma recorrência criada ainda</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Crie lançamentos recorrentes como salário, aluguel, internet ou mensalidades em{" "}
              <strong>Lançamentos</strong>.
            </p>
          </CardContent></Card>
        ) : (
          <Card><CardContent className="divide-y p-0">
            {rules.map((r) => (
              <div key={r.id} className={cn("flex items-center gap-3 p-3 sm:px-4", !r.active && "opacity-50")}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Repeat className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.description}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {describeCadence(r.frequency, r.interval)} · próx. {formatDate(r.next_run_date)} · {r.accountName}
                  </p>
                </div>
                <p className={cn("tabular shrink-0 font-semibold", r.type === "income" ? "text-success" : "text-destructive")}>
                  {r.type === "income" ? "+" : "−"}{formatBRL(r.amount_cents)}
                </p>
                <div className="flex shrink-0 items-center">
                  {busyId === r.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleRule(r)} aria-label={r.active ? "Pausar" : "Retomar"} title={r.active ? "Pausar" : "Retomar"}>
                    <Power className={cn("h-4 w-4", r.active && "text-success")} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editRule(r)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setRecDelete(r)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </CardContent></Card>
        )
      )}

      <TransactionFormDialog
        key={txEdit?.id ?? "none"}
        open={txOpen}
        onClose={() => setTxOpen(false)}
        accounts={accounts}
        categories={categories}
        tags={tags}
        editing={txEdit}
      />
      <RecurringFormDialog
        key={recEdit?.id ?? "new-rec"}
        open={recOpen}
        onClose={() => setRecOpen(false)}
        accounts={accounts}
        categories={categories}
        editing={recEdit}
      />

      <Dialog open={!!txDelete} onClose={() => setTxDelete(null)} title="Excluir previsto">
        <p className="mb-4 text-sm">Excluir <strong>{txDelete?.description}</strong>?</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setTxDelete(null)}>Cancelar</Button>
          <Button variant="destructive" onClick={confirmDeleteTx} disabled={busyId === txDelete?.id}>Excluir</Button>
        </div>
      </Dialog>
      <Dialog open={!!recDelete} onClose={() => setRecDelete(null)} title="Excluir recorrência" description="Remove a regra e os previstos ainda não realizados que ela gerou.">
        <p className="mb-4 text-sm">Excluir <strong>{recDelete?.description}</strong>?</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setRecDelete(null)}>Cancelar</Button>
          <Button variant="destructive" onClick={confirmDeleteRule} disabled={busyId === recDelete?.id}>Excluir</Button>
        </div>
      </Dialog>
    </div>
  );
}

function PendingGroup({
  title, items, overdue, busyId, onQuitar, onEdit, onDelete,
}: {
  title: string;
  items: PendingItem[];
  overdue?: boolean;
  busyId: string | null;
  onQuitar: (p: PendingItem) => void;
  onEdit: (p: PendingItem) => void;
  onDelete: (p: PendingItem) => void;
}) {
  if (items.length === 0) return null;
  const total = items.reduce((a, p) => a + (p.kind === "income" ? p.amount_cents : -p.amount_cents), 0);
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
        {overdue && <AlertTriangle className="h-4 w-4 text-destructive" />}
        <span className="text-xs text-muted-foreground">({items.length})</span>
        <span className={cn("tabular ml-auto text-sm font-medium", total < 0 ? "text-destructive" : "text-success")}>
          {total >= 0 ? "+" : "−"}{formatBRL(Math.abs(total))}
        </span>
      </div>
      <Card><CardContent className="divide-y p-0">
        {items.map((p) => (
          <div key={p.id} className="flex items-center gap-3 p-3 sm:px-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: p.category?.color ?? p.account?.color ?? "#64748b" }}>
              <Icon name={p.category?.icon ?? p.account?.icon} className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium">{p.description}</p>
                {p.fromRecurring && <Repeat className="h-3 w-3 shrink-0 text-muted-foreground" />}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                vence {formatDate(p.date)} · {p.account?.name ?? ""}
              </p>
            </div>
            <p className={cn("tabular shrink-0 font-semibold", p.kind === "income" ? "text-success" : "text-destructive")}>
              {p.kind === "income" ? "+" : "−"}{formatBRL(p.amount_cents)}
            </p>
            <div className="flex shrink-0 items-center">
              {busyId === p.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onQuitar(p)} aria-label="Quitar" title="Marcar como realizado">
                <Check className="h-4 w-4 text-success" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(p)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(p)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </CardContent></Card>
    </div>
  );
}
