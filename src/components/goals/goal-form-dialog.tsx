"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { MoneyInput } from "@/components/money-input";
import { ColorPicker } from "@/components/color-picker";
import { formatBRL } from "@/lib/format";
import { FREQUENCY_OPTIONS, type GoalInput } from "@/lib/zod-schemas/goal";
import { createGoal, updateGoal } from "@/app/(app)/metas/actions";

export interface GoalEdit {
  id: string;
  name: string;
  targetCents: number;
  deadline: string | null;
  color: string;
  recurringContributionCents: number | null;
  contributionFrequency: string | null;
  startDate: string | null;
  accountId: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  goal: GoalEdit | null;
  accounts: { id: string; name: string }[];
}

const today = () => new Date().toISOString().slice(0, 10);

export function GoalFormDialog({ open, onClose, goal, accounts }: Props) {
  const router = useRouter();
  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState(goal?.targetCents ?? 0);
  const [deadline, setDeadline] = useState(goal?.deadline ?? "");
  const [color, setColor] = useState(goal?.color ?? "#22c55e");
  const [recurring, setRecurring] = useState(goal?.recurringContributionCents ?? 0);
  const [frequency, setFrequency] = useState<string>(goal?.contributionFrequency ?? "monthly");
  const [startDate, setStartDate] = useState(goal?.startDate ?? today());
  const [accountId, setAccountId] = useState(goal?.accountId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(goal?.name ?? "");
    setTarget(goal?.targetCents ?? 0);
    setDeadline(goal?.deadline ?? "");
    setColor(goal?.color ?? "#22c55e");
    setRecurring(goal?.recurringContributionCents ?? 0);
    setFrequency(goal?.contributionFrequency ?? "monthly");
    setStartDate(goal?.startDate ?? today());
    setAccountId(goal?.accountId ?? "");
    setError(null);
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, goal]);

  // Pré-visualização
  const preview = useMemo(() => {
    if (target <= 0) return null;
    const remaining = target;
    if (recurring > 0) {
      const periodsNeeded = Math.ceil(remaining / recurring);
      const d = new Date(startDate + "T12:00:00");
      if (frequency === "weekly") d.setDate(d.getDate() + periodsNeeded * 7);
      else if (frequency === "fortnightly") d.setDate(d.getDate() + periodsNeeded * 14);
      else d.setMonth(d.getMonth() + periodsNeeded);
      const est = d.toISOString().slice(0, 10);
      const label = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "America/Sao_Paulo" }).format(d);
      return { remaining, periodsNeeded, estimatedDate: est, estimatedLabel: label };
    }
    if (deadline) {
      const d = new Date(deadline + "T12:00:00");
      const now = new Date();
      const months = Math.max(1, (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth()));
      const perPeriod = Math.ceil(remaining / months);
      return { remaining, monthlyNeeded: perPeriod, deadlineLabel: deadline };
    }
    return null;
  }, [target, recurring, frequency, startDate, deadline]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const payload: GoalInput = {
      name,
      target_cents: target,
      deadline: deadline || null,
      color,
      recurring_contribution_cents: recurring > 0 ? recurring : null,
      contribution_frequency: recurring > 0 ? frequency as "monthly" | "fortnightly" | "weekly" | "custom" : null,
      start_date: startDate || null,
      account_id: accountId || null,
    };
    const res = goal ? await updateGoal(goal.id, payload) : await createGoal(payload);
    setSaving(false);
    if (!res.ok) { setError(res.error); return; }
    router.refresh();
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title={goal ? "Editar meta" : "Nova meta"} className="sm:max-w-lg">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="g-name">Nome</Label>
          <Input id="g-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Reserva de emergência" autoFocus />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="g-target">Valor-alvo</Label>
          <MoneyInput id="g-target" value={target} onChange={setTarget} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="g-start">Data inicial</Label>
            <Input id="g-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-deadline">Prazo desejado (opcional)</Label>
            <Input id="g-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="g-recurring">Aporte recorrente</Label>
            <MoneyInput id="g-recurring" value={recurring} onChange={setRecurring} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-freq">Frequência</Label>
            <Select id="g-freq" value={frequency} onChange={(e) => setFrequency(e.target.value)} disabled={recurring <= 0}>
              {FREQUENCY_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Cor</Label>
          <ColorPicker value={color} onChange={setColor} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="g-account">Conta vinculada (opcional)</Label>
          <Select id="g-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Nenhuma conta</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
          <p className="text-[10px] text-muted-foreground">Indica onde o dinheiro reservado está guardado. O saldo da conta não será alterado.</p>
        </div>

        {/* Pré-visualização */}
        {preview && (
          <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
            <p>Faltam <strong className="text-foreground">{formatBRL(preview.remaining)}</strong></p>
            {"periodsNeeded" in preview && (
              <p>
                Você atingirá essa meta em aproximadamente{" "}
                <strong className="text-foreground">
                  {preview.periodsNeeded} {preview.periodsNeeded === 1 ? "período" : "períodos"}
                </strong>
                {" · Previsão: "}<strong className="text-foreground">{preview.estimatedLabel}</strong>
              </p>
            )}
            {"monthlyNeeded" in preview && (
              <p>
                Para atingir essa meta até{" "}
                <strong className="text-foreground">{preview.deadlineLabel}</strong>,
                você precisa guardar aproximadamente{" "}
                <strong className="text-foreground">{formatBRL(preview.monthlyNeeded!)}</strong> por período.
              </p>
            )}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving || !name.trim() || target <= 0}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {goal ? "Salvar" : "Criar meta"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
