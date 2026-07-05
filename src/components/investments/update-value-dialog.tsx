"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/money-input";
import { updateInvestmentValue } from "@/app/(app)/investimentos/actions";

interface Props {
  open: boolean;
  onClose: () => void;
  investmentId: string | null;
  investmentName: string;
  currentCents: number;
}

export function UpdateValueDialog({ open, onClose, investmentId, investmentName, currentCents }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(currentCents);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reinicializa ao abrir com o valor atual do ativo clicado.
  useEffect(() => {
    if (!open) return;
    setValue(currentCents);
    setError(null);
    setSaving(false);
  }, [open, currentCents]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!investmentId) return;
    setError(null);
    setSaving(true);
    const res = await updateInvestmentValue(investmentId, value);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Atualizar valor atual" description={investmentName}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="uv-value">Valor atual (saldo na corretora)</Label>
          <MoneyInput id="uv-value" value={value} onChange={setValue} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
