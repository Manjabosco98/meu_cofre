"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Plus, Pencil, Copy, Trash2, Check, Undo2, ArrowLeftRight, Loader2,
  ChevronLeft, ChevronRight, Receipt, Paperclip, Repeat,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/lucide-icon";
import { FiltersBar } from "@/components/transactions/filters-bar";
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog";
import { formatBRL, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  setTransactionStatus, deleteTransaction, duplicateTransaction,
} from "@/app/(app)/lancamentos/actions";
import type {
  AccountOption, CategoryOption, TagOption, TxItem, TxEditData,
} from "@/components/transactions/types";

interface Props {
  items: TxItem[];
  summary: { incomeCents: number; expenseCents: number };
  page: number;
  pageSize: number;
  totalCount: number;
  accounts: AccountOption[];
  categories: CategoryOption[];
  tags: TagOption[];
}

export function TransactionsView({
  items, summary, page, pageSize, totalCount, accounts, categories, tags,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TxEditData | null>(null);
  const [toDelete, setToDelete] = useState<TxItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const result = summary.incomeCents - summary.expenseCents;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(it: TxItem) {
    setEditing({
      id: it.id,
      type: it.kind,
      amount_cents: it.amount_cents,
      date: it.date.slice(0, 10),
      description: it.description,
      account_id: it.kind === "transfer" ? it.fromAccount?.id ?? "" : it.account?.id ?? "",
      to_account_id: it.toAccount?.id ?? null,
      category_id: it.category?.id ?? null,
      tag_ids: it.tags.map((t) => t.id),
      notes: it.notes,
      status: it.status,
      transferGroupId: it.transferGroupId,
      valorRealizado: it.valorRealizado,
    });
    setFormOpen(true);
  }
  async function toggleStatus(it: TxItem) {
    setBusyId(it.id);
    await setTransactionStatus(
      it.id,
      it.status === "cleared" ? "pending" : "cleared",
      it.transferGroupId,
    );
    setBusyId(null);
    router.refresh();
  }
  async function duplicate(it: TxItem) {
    setBusyId(it.id);
    await duplicateTransaction(it.id);
    setBusyId(null);
    router.refresh();
  }
  async function confirmDelete() {
    if (!toDelete) return;
    setBusyId(toDelete.id);
    await deleteTransaction(toDelete.id, toDelete.transferGroupId);
    setBusyId(null);
    setToDelete(null);
    router.refresh();
  }
  function goPage(p: number) {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(p));
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Lançamentos</h1>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Novo lançamento
        </Button>
      </div>

      {/* Resumo do período filtrado (realizados) */}
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Receitas" value={summary.incomeCents} className="text-success" />
        <SummaryCard label="Despesas" value={summary.expenseCents} className="text-destructive" />
        <SummaryCard label="Resultado" value={result} signed className={result < 0 ? "text-destructive" : "text-success"} />
      </div>

      <FiltersBar accounts={accounts} categories={categories} />

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Receipt className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium">Nenhum lançamento no período</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Ajuste os filtros ou registre um novo lançamento.
            </p>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Novo lançamento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {items.map((it) => (
              <Row
                key={it.transferGroupId ?? it.id}
                item={it}
                busy={busyId === it.id}
                onEdit={() => openEdit(it)}
                onToggle={() => toggleStatus(it)}
                onDuplicate={() => duplicate(it)}
                onDelete={() => setToDelete(it)}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {page} de {totalPages} · {totalCount} lançamento(s)
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => goPage(page + 1)}>
              Próxima <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <TransactionFormDialog
        key={editing?.id ?? "new"}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        accounts={accounts}
        categories={categories}
        tags={tags}
        editing={editing}
      />

      <Dialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Excluir lançamento"
        description={toDelete?.kind === "transfer" ? "Remove as duas pernas da transferência." : undefined}
      >
        <p className="mb-4 text-sm">
          Excluir <strong>{toDelete?.description}</strong>?
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setToDelete(null)}>Cancelar</Button>
          <Button variant="destructive" onClick={confirmDelete} disabled={busyId === toDelete?.id}>
            {busyId === toDelete?.id && <Loader2 className="h-4 w-4 animate-spin" />}
            Excluir
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function SummaryCard({
  label, value, className, signed,
}: {
  label: string;
  value: number;
  className?: string;
  signed?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={cn("tabular text-xl font-bold", className)}>
          {signed && value > 0 ? "+" : ""}
          {formatBRL(value)}
        </p>
      </CardContent>
    </Card>
  );
}

function Row({
  item, busy, onEdit, onToggle, onDuplicate, onDelete,
}: {
  item: TxItem;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const isTransfer = item.kind === "transfer";
  const sign = item.kind === "income" ? "+" : item.kind === "expense" ? "−" : "";
  const amountClass =
    item.kind === "income" ? "text-success" : item.kind === "expense" ? "text-destructive" : "text-foreground";

  const iconColor = isTransfer ? "#6366f1" : item.category?.color ?? item.account?.color ?? "#64748b";
  const meta = isTransfer
    ? `${item.fromAccount?.name ?? "?"} → ${item.toAccount?.name ?? "?"}`
    : `${item.category?.name ?? "Sem categoria"} · ${item.account?.name ?? ""}`;

  return (
    <div className="flex items-center gap-3 p-3 sm:px-4">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
        style={{ backgroundColor: iconColor }}
      >
        {isTransfer ? <ArrowLeftRight className="h-4 w-4" /> : <Icon name={item.category?.icon ?? item.account?.icon} className="h-4 w-4" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{item.description}</p>
          {item.status === "pending" ? (
            <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400">
              Previsto
            </Badge>
          ) : (
            <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              Realizado
            </Badge>
          )}
          {item.attachmentCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground" title={`${item.attachmentCount} anexo(s)`}>
              <Paperclip className="h-3 w-3" />
              {item.attachmentCount}
            </span>
          )}
          {item.recurringRuleId && (
            <span className="inline-flex items-center gap-0.5 text-xs text-violet-600 dark:text-violet-400" title="Lançamento recorrente">
              <Repeat className="h-3 w-3" />
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {formatDate(item.date)} · {meta}
        </p>
        {/* Diferença previsto x realizado */}
        {item.status === "cleared" && item.valorRealizado != null && item.valorRealizado !== item.valorPrevisto && (
          <p className={cn(
            "mt-0.5 text-xs font-medium",
            item.valorRealizado > item.valorPrevisto ? "text-success" : "text-destructive",
          )}>
            Previsto {formatBRL(item.valorPrevisto)} · Realizado {formatBRL(item.valorRealizado)} ·{" "}
            Diferença {item.valorRealizado > item.valorPrevisto ? "+" : "−"}{formatBRL(Math.abs(item.valorRealizado - item.valorPrevisto))}
          </p>
        )}
        {item.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {item.tags.map((t) => (
              <span key={t.id} className="rounded-full px-1.5 text-[10px] font-medium" style={{ color: t.color, backgroundColor: `${t.color}20` }}>
                {t.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <p className={cn("tabular shrink-0 font-semibold", amountClass)}>
        {sign}{formatBRL(item.amount_cents)}
      </p>

      <div className="flex shrink-0 items-center">
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onToggle}
          aria-label={item.status === "cleared" ? "Marcar como previsto" : "Marcar como realizado"}
          title={item.status === "cleared" ? "Marcar como previsto" : "Marcar como realizado"}
        >
          {item.status === "cleared" ? <Undo2 className="h-4 w-4" /> : <Check className="h-4 w-4 text-success" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} aria-label="Editar">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDuplicate} aria-label="Duplicar">
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={onDelete}
          aria-label="Excluir"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
