"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Repeat } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/money-input";
import { cn } from "@/lib/utils";
import { FREQUENCY_LABELS, type Frequency } from "@/lib/recurrence";
import { AttachmentSection } from "@/components/transactions/attachment-section";
import type { AccountOption, CategoryOption, TagOption, TxKind, TxStatus, TxEditData } from "@/components/transactions/types";
import type { TransactionInput } from "@/lib/zod-schemas/transaction";
import {
  createTransaction,
  updateTransaction,
  updateTransfer,
} from "@/app/(app)/lancamentos/actions";

interface Props {
  open: boolean;
  onClose: () => void;
  accounts: AccountOption[];
  categories: CategoryOption[];
  tags: TagOption[];
  editing: TxEditData | null;
}

const today = () => new Date().toISOString().slice(0, 10);

const KIND_META: Record<TxKind, { label: string; active: string }> = {
  income: { label: "Receita", active: "border-success bg-success/10 text-success" },
  expense: { label: "Despesa", active: "border-destructive bg-destructive/10 text-destructive" },
  transfer: { label: "Transferência", active: "border-primary bg-primary/10 text-primary" },
};

export function TransactionFormDialog({ open, onClose, accounts, categories, tags, editing }: Props) {
  const router = useRouter();
  const isEdit = !!editing;

  const [type, setType] = useState<TxKind>(editing?.type ?? "expense");
  const [amount, setAmount] = useState(editing?.amount_cents ?? 0);
  const [date, setDate] = useState(editing?.date ?? today());
  const [description, setDescription] = useState(editing?.description ?? "");
  const [accountId, setAccountId] = useState(editing?.account_id ?? accounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(editing?.to_account_id ?? "");
  const [categoryId, setCategoryId] = useState(editing?.category_id ?? "");
  const [tagIds, setTagIds] = useState<string[]>(editing?.tag_ids ?? []);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [status, setStatus] = useState<TxStatus>(editing?.status ?? "cleared");
  const [valorRealizado, setValorRealizado] = useState<number>(editing?.valorRealizado ?? editing?.amount_cents ?? 0);
  // Recorrência
  const [recEnabled, setRecEnabled] = useState(false);
  const [recFrequency, setRecFrequency] = useState<Frequency>("monthly");
  const [recInterval, setRecInterval] = useState(1);
  const [recEndType, setRecEndType] = useState<"never" | "date" | "count">("never");
  const [recEndDate, setRecEndDate] = useState("");
  const [recOccurrences, setRecOccurrences] = useState<number>(12);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reinicializa ao abrir
  useEffect(() => {
    if (!open) return;
    setType(editing?.type ?? "expense");
    setAmount(editing?.amount_cents ?? 0);
    setDate(editing?.date ?? today());
    setDescription(editing?.description ?? "");
    setAccountId(editing?.account_id ?? accounts[0]?.id ?? "");
    setToAccountId(editing?.to_account_id ?? "");
    setCategoryId(editing?.category_id ?? "");
    setTagIds(editing?.tag_ids ?? []);
    setNotes(editing?.notes ?? "");
    setStatus(editing?.status ?? "cleared");
    setValorRealizado(editing?.valorRealizado ?? editing?.amount_cents ?? 0);
    setRecEnabled(false);
    setRecFrequency("monthly");
    setRecInterval(1);
    setRecEndType("never");
    setRecEndDate("");
    setRecOccurrences(12);
    setError(null);
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const canRecur = type === "income" || type === "expense";
  const showRecurrence = recEnabled && canRecur;

  // Forçar status para pending quando recorrência está ativa
  useEffect(() => {
    if (showRecurrence && status === "cleared") {
      setStatus("pending");
    }
  }, [showRecurrence, status]);

  const catKind = type === "income" ? "income" : "expense";
  const parents = categories.filter((c) => c.kind === catKind && !c.parent_id);
  const childrenOf = (id: string) => categories.filter((c) => c.parent_id === id);

  function toggleTag(id: string) {
    setTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload: TransactionInput = {
      type,
      amount_cents: amount,
      date,
      description,
      account_id: accountId,
      to_account_id: type === "transfer" ? toAccountId || null : null,
      category_id: type === "transfer" ? null : categoryId || null,
      tag_ids: type === "transfer" ? [] : tagIds,
      notes: notes || null,
      status: showRecurrence ? "pending" : status,
      valor_realizado: status === "cleared" && !showRecurrence ? valorRealizado : null,
      recurrence: showRecurrence ? {
        frequency: recFrequency,
        interval: recInterval,
        end_type: recEndType,
        end_date: recEndType === "date" ? recEndDate || null : null,
        occurrences: recEndType === "count" ? recOccurrences : null,
      } : null,
    };

    let res;
    if (isEdit && editing) {
      res =
        editing.transferGroupId && type === "transfer"
          ? await updateTransfer(editing.transferGroupId, payload)
          : await updateTransaction(editing.id, payload);
    } else {
      res = await createTransaction(payload);
    }
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar lançamento" : "Novo lançamento"}
      className="sm:max-w-lg"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {/* Tipo */}
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(KIND_META) as TxKind[]).map((k) => (
            <button
              key={k}
              type="button"
              disabled={isEdit}
              onClick={() => setType(k)}
              className={cn(
                "rounded-md border px-2 py-2 text-sm font-medium transition disabled:opacity-60",
                type === k ? KIND_META[k].active : "text-muted-foreground hover:bg-accent",
              )}
            >
              {KIND_META[k].label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="tx-amount">{status === "cleared" && !showRecurrence ? "Valor previsto" : "Valor"}</Label>
            <MoneyInput id="tx-amount" value={amount} onChange={setAmount} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tx-date">Data</Label>
            <Input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tx-desc">Descrição</Label>
          <Input id="tx-desc" value={description} onChange={(e) => setDescription(e.target.value)} autoFocus />
        </div>

        {/* Contas */}
        {type === "transfer" ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tx-from">De</Label>
              <Select id="tx-from" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-to">Para</Label>
              <Select id="tx-to" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                <option value="">Selecione…</option>
                {accounts.filter((a) => a.id !== accountId).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tx-account">Conta</Label>
              <Select id="tx-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-cat">Categoria</Label>
              <Select id="tx-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Sem categoria</option>
                {parents.map((p) => (
                  <optgroup key={p.id} label={p.name}>
                    <option value={p.id}>{p.name} (geral)</option>
                    {childrenOf(p.id).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </div>
          </div>
        )}

        {/* Tags */}
        {type !== "transfer" && tags.length > 0 && (
          <div className="space-y-1.5">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => {
                const on = tagIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTag(t.id)}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs font-medium transition",
                      on ? "text-white" : "text-muted-foreground hover:bg-accent",
                    )}
                    style={on ? { backgroundColor: t.color, borderColor: t.color } : { borderColor: t.color }}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Status */}
        <div className="space-y-1.5">
          <Label>Situação</Label>
          <div className="grid grid-cols-2 gap-2">
            {(["cleared", "pending"] as TxStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                disabled={showRecurrence}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm font-medium transition disabled:opacity-60",
                  status === s ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent",
                )}
              >
                {s === "cleared" ? "Realizado" : "Previsto"}
              </button>
            ))}
          </div>
          {showRecurrence && (
            <p className="text-[10px] text-muted-foreground">Recorrência gera lançamentos como previstos.</p>
          )}
        </div>

        {/* Valor realizado */}
        {status === "cleared" && !showRecurrence && (
          <div className="space-y-1.5">
            <Label htmlFor="tx-valor-realizado">Valor recebido/pago</Label>
            <MoneyInput id="tx-valor-realizado" value={valorRealizado} onChange={setValorRealizado} />
            {valorRealizado !== amount && (
              <p className={cn("text-xs font-medium", valorRealizado > amount ? "text-success" : "text-destructive")}>
                {valorRealizado > amount ? "A mais" : "A menos"} diferença: {valorRealizado > amount ? "+" : "−"}R$ {(Math.abs(valorRealizado - amount) / 100).toFixed(2).replace(".", ",")}
              </p>
            )}
          </div>
        )}

        {/* Observação */}
        <div className="space-y-1.5">
          <Label htmlFor="tx-notes">Observação</Label>
          <Textarea id="tx-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Opcional" />
        </div>

        {/* Recorrência */}
        {canRecur && !isEdit && (
          <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={recEnabled}
                onClick={() => setRecEnabled(!recEnabled)}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                  recEnabled ? "bg-primary" : "bg-muted",
                )}
              >
                <span className={cn("pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform", recEnabled ? "translate-x-4" : "translate-x-0")} />
              </button>
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Repeat className="h-3.5 w-3.5" /> Lançamento recorrente
                </p>
                <p className="text-xs text-muted-foreground">Gera lançamentos futuros automaticamente</p>
              </div>
            </div>

            {showRecurrence && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="rec-freq">Frequência</Label>
                    <Select id="rec-freq" value={recFrequency} onChange={(e) => setRecFrequency(e.target.value as Frequency)}>
                      {(Object.entries(FREQUENCY_LABELS) as [Frequency, string][]).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rec-interval">A cada</Label>
                    <Input id="rec-interval" type="number" min={1} max={365} value={recInterval}
                      onChange={(e) => setRecInterval(Math.max(1, parseInt(e.target.value || "1", 10)))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="rec-end-type">Término</Label>
                    <Select id="rec-end-type" value={recEndType} onChange={(e) => setRecEndType(e.target.value as "never" | "date" | "count")}>
                      <option value="never">Sem data final</option>
                      <option value="date">Em uma data</option>
                      <option value="count">Após N repetições</option>
                    </Select>
                  </div>
                  {recEndType === "date" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="rec-end-date">Data final</Label>
                      <Input id="rec-end-date" type="date" value={recEndDate} onChange={(e) => setRecEndDate(e.target.value)} />
                    </div>
                  )}
                  {recEndType === "count" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="rec-occ">Repetições</Label>
                      <Input id="rec-occ" type="number" min={1} max={600} value={recOccurrences}
                        onChange={(e) => setRecOccurrences(Math.max(1, parseInt(e.target.value || "1", 10)))} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Anexos (só na edição) */}
        {isEdit && editing && (
          <AttachmentSection transactionId={editing.id} open={open} />
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving || !description.trim() || amount <= 0}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Salvar" : showRecurrence ? "Criar recorrência" : "Adicionar"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
