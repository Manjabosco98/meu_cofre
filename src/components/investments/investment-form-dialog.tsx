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
import { INVESTMENT_TYPE_OPTIONS } from "@/lib/investment-meta";
import type { InvestmentInput } from "@/lib/zod-schemas/investment";
import { createInvestment, updateInvestment } from "@/app/(app)/investimentos/actions";

export interface InvestmentEdit {
  id: string;
  name: string;
  type: string;
  currentCents: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  investment: InvestmentEdit | null;
}

export function InvestmentFormDialog({ open, onClose, investment }: Props) {
  const router = useRouter();
  const [name, setName] = useState(investment?.name ?? "");
  const [type, setType] = useState(investment?.type ?? "renda_fixa");
  const [current, setCurrent] = useState(investment?.currentCents ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reinicializa ao abrir: "novo investimento" limpo, "editar" com os dados do ativo.
  useEffect(() => {
    if (!open) return;
    setName(investment?.name ?? "");
    setType(investment?.type ?? "renda_fixa");
    setCurrent(investment?.currentCents ?? 0);
    setError(null);
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, investment]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const payload: InvestmentInput = { name, type, current_value_cents: current };
    const res = investment ? await updateInvestment(investment.id, payload) : await createInvestment(payload);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title={investment ? "Editar investimento" : "Novo investimento"}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="i-name">Nome</Label>
          <Input id="i-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Tesouro Selic 2029" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="i-type">Tipo</Label>
            <Select id="i-type" value={type} onChange={(e) => setType(e.target.value)}>
              {INVESTMENT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="i-current">Valor atual</Label>
            <MoneyInput id="i-current" value={current} onChange={setCurrent} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          O valor atual é informado manualmente (atualize conforme o extrato da corretora). Os aportes e resgates são registrados à parte.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {investment ? "Salvar" : "Criar"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
