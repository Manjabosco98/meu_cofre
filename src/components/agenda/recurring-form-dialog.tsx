"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { MoneyInput } from "@/components/money-input";
import { cn } from "@/lib/utils";
import type { AccountOption, CategoryOption } from "@/components/transactions/types";
import type { Frequency } from "@/lib/recurrence";
import type { RecurringInput } from "@/lib/zod-schemas/recurring";
import { createRecurringRule, updateRecurringRule } from "@/app/(app)/agenda/actions";

export interface RecurringEditData {
  id: string;
  type: "income" | "expense";
  description: string;
  amount_cents: number;
  account_id: string;
  category_id: string | null;
  frequency: Frequency;
  interval: number;
  start_date: string;
  end_type: "never" | "date" | "count";
  end_date: string | null;
  occurrences: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  accounts: AccountOption[];
  categories: CategoryOption[];
  editing: RecurringEditData | null;
}

const today = () => new Date().toISOString().slice(0, 10);

export function RecurringFormDialog({ open, onClose, accounts, categories, editing }: Props) {
  const router = useRouter();
  const [type, setType] = useState<"income" | "expense">(editing?.type ?? "expense");
  const [amount, setAmount] = useState(editing?.amount_cents ?? 0);
  const [description, setDescription] = useState(editing?.description ?? "");
  const [accountId, setAccountId] = useState(editing?.account_id ?? accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(editing?.category_id ?? "");
  const [frequency, setFrequency] = useState<Frequency>(editing?.frequency ?? "monthly");
  const [interval, setIntervalN] = useState(editing?.interval ?? 1);
  const [startDate, setStartDate] = useState(editing?.start_date ?? today());
  const [endType, setEndType] = useState<"never" | "date" | "count">(editing?.end_type ?? "never");
  const [endDate, setEndDate] = useState(editing?.end_date ?? "");
  const [occurrences, setOccurrences] = useState(editing?.occurrences ?? 12);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reinicializa ao abrir: "nova recorrência" limpa, "editar" com os dados da regra.
  useEffect(() => {
    if (!open) return;
    setType(editing?.type ?? "expense");
    setAmount(editing?.amount_cents ?? 0);
    setDescription(editing?.description ?? "");
    setAccountId(editing?.account_id ?? accounts[0]?.id ?? "");
    setCategoryId(editing?.category_id ?? "");
    setFrequency(editing?.frequency ?? "monthly");
    setIntervalN(editing?.interval ?? 1);
    setStartDate(editing?.start_date ?? today());
    setEndType(editing?.end_type ?? "never");
    setEndDate(editing?.end_date ?? "");
    setOccurrences(editing?.occurrences ?? 12);
    setError(null);
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const parents = categories.filter((c) => c.kind === type && !c.parent_id);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const payload: RecurringInput = {
      type,
      description,
      amount_cents: amount,
      account_id: accountId,
      category_id: categoryId || null,
      frequency,
      interval,
      start_date: startDate,
      end_type: endType,
      end_date: endType === "date" ? endDate : null,
      occurrences: endType === "count" ? occurrences : null,
    };
    const res = editing ? await updateRecurringRule(editing.id, payload) : await createRecurringRule(payload);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title={editing ? "Editar recorrência" : "Nova recorrência"} className="sm:max-w-lg">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {(["expense", "income"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => { setType(k); setCategoryId(""); }}
              className={cn(
                "rounded-md border px-3 py-2 text-sm font-medium transition",
                type === k
                  ? k === "income" ? "border-success bg-success/10 text-success" : "border-destructive bg-destructive/10 text-destructive"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {k === "income" ? "Receita" : "Despesa"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="r-amount">Valor</Label>
            <MoneyInput id="r-amount" value={amount} onChange={setAmount} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-start">Início</Label>
            <Input id="r-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="r-desc">Descrição</Label>
          <Input id="r-desc" value={description} onChange={(e) => setDescription(e.target.value)} autoFocus />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="r-acc">Conta</Label>
            <Select id="r-acc" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-cat">Categoria</Label>
            <Select id="r-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Sem categoria</option>
              {parents.map((p) => (
                <optgroup key={p.id} label={p.name}>
                  <option value={p.id}>{p.name} (geral)</option>
                  {categories.filter((c) => c.parent_id === p.id).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="r-freq">Frequência</Label>
            <Select id="r-freq" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
              <option value="daily">Diária</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensal</option>
              <option value="yearly">Anual</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-int">A cada</Label>
            <Input id="r-int" type="number" min={1} max={365} value={interval}
              onChange={(e) => setIntervalN(Math.max(1, parseInt(e.target.value || "1", 10)))} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="r-end">Término</Label>
          <Select id="r-end" value={endType} onChange={(e) => setEndType(e.target.value as "never" | "date" | "count")}>
            <option value="never">Sem fim</option>
            <option value="date">Até uma data</option>
            <option value="count">Nº de repetições</option>
          </Select>
        </div>
        {endType === "date" && (
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        )}
        {endType === "count" && (
          <Input type="number" min={1} max={600} value={occurrences}
            onChange={(e) => setOccurrences(Math.max(1, parseInt(e.target.value || "1", 10)))} />
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving || !description.trim() || amount <= 0}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? "Salvar" : "Criar"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
