"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/money-input";
import { cn } from "@/lib/utils";
import type { ContributionInput } from "@/lib/zod-schemas/goal";
import { addContribution } from "@/app/(app)/metas/actions";

interface Props {
  open: boolean;
  onClose: () => void;
  goalId: string | null;
  goalName: string;
}

const today = () => new Date().toISOString().slice(0, 10);

export function ContributionDialog({ open, onClose, goalId, goalName }: Props) {
  const router = useRouter();
  const [kind, setKind] = useState<"aporte" | "resgate">("aporte");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reinicializa ao abrir (limpa a movimentação anterior).
  useEffect(() => {
    if (!open) return;
    setKind("aporte");
    setAmount(0);
    setDate(today());
    setNote("");
    setError(null);
    setSaving(false);
  }, [open, goalId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!goalId) return;
    setError(null);
    setSaving(true);
    const payload: ContributionInput = {
      goal_id: goalId,
      amount_cents: amount,
      date,
      note: note || null,
      type: kind === "aporte" ? "contribution" : "withdrawal",
    };
    const res = await addContribution(payload);
    setSaving(false);
    if (!res.ok) { setError(res.error); return; }
    router.refresh();
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Movimentar meta" description={goalName}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {([["aporte", "Aporte"], ["resgate", "Resgate"]] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setKind(v)}
              className={cn(
                "rounded-md border px-3 py-2 text-sm font-medium transition",
                kind === v
                  ? v === "aporte" ? "border-success bg-success/10 text-success" : "border-destructive bg-destructive/10 text-destructive"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="c-amount">Valor</Label>
            <MoneyInput id="c-amount" value={amount} onChange={setAmount} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-date">Data</Label>
            <Input id="c-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-note">Observação</Label>
          <Input id="c-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Este {kind === "aporte" ? "aporte reserva" : "resgate libera"} parte do saldo da conta para esta meta. O saldo real da conta <strong>não será alterado</strong>.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving || amount <= 0}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Registrar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
