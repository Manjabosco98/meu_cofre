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
import type { InvestmentEntryInput } from "@/lib/zod-schemas/investment";
import { addInvestmentEntry } from "@/app/(app)/investimentos/actions";

interface Props {
  open: boolean;
  onClose: () => void;
  investmentId: string | null;
  investmentName: string;
}

const today = () => new Date().toISOString().slice(0, 10);

export function InvestmentEntryDialog({ open, onClose, investmentId, investmentName }: Props) {
  const router = useRouter();
  const [kind, setKind] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reinicializa ao abrir (limpa valores da movimentação anterior).
  useEffect(() => {
    if (!open) return;
    setKind("deposit");
    setAmount(0);
    setDate(today());
    setNote("");
    setError(null);
    setSaving(false);
  }, [open, investmentId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!investmentId) return;
    setError(null);
    setSaving(true);
    const payload: InvestmentEntryInput = {
      investment_id: investmentId,
      amount_cents: amount,
      type: kind,
      date,
      note: note || null,
    };
    const res = await addInvestmentEntry(payload);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Movimentar investimento" description={investmentName}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {([["deposit", "Aporte"], ["withdraw", "Resgate"]] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setKind(v)}
              className={cn(
                "rounded-md border px-3 py-2 text-sm font-medium transition",
                kind === v
                  ? v === "deposit"
                    ? "border-success bg-success/10 text-success"
                    : "border-destructive bg-destructive/10 text-destructive"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ie-amount">Valor</Label>
            <MoneyInput id="ie-amount" value={amount} onChange={setAmount} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ie-date">Data</Label>
            <Input id="ie-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ie-note">Observação</Label>
          <Input id="ie-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" />
        </div>
        <p className="text-xs text-muted-foreground">
          Aportes e resgates definem o <strong>valor investido</strong>. Lembre de atualizar o valor atual para refletir a rentabilidade.
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
