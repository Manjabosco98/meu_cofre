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
import type { PayInvoiceInput } from "@/lib/zod-schemas/card";
import { payInvoice } from "@/app/(app)/cartoes/actions";

interface AccountOpt {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  invoiceId: string | null;
  totalCents: number;
  accounts: AccountOpt[];
  defaultAccountId?: string | null;
}

const today = () => new Date().toISOString().slice(0, 10);

export function PayInvoiceDialog({ open, onClose, invoiceId, totalCents, accounts, defaultAccountId }: Props) {
  const router = useRouter();
  // Origem padrão: conta vinculada ao cartão, se existir; senão a primeira conta.
  const preselected = defaultAccountId && accounts.some((a) => a.id === defaultAccountId)
    ? defaultAccountId
    : accounts[0]?.id ?? "";
  const [fromAccount, setFromAccount] = useState(preselected);
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState(totalCents);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reinicializa ao abrir com os dados da fatura clicada (origem padrão, valor total).
  useEffect(() => {
    if (!open) return;
    setFromAccount(preselected);
    setDate(today());
    setAmount(totalCents);
    setError(null);
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoiceId, totalCents, defaultAccountId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invoiceId) return;
    setError(null);
    setSaving(true);
    const payload: PayInvoiceInput = {
      invoice_id: invoiceId,
      from_account_id: fromAccount,
      date,
      amount_cents: amount,
    };
    const res = await payInvoice(payload);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Pagar fatura" description="Gera uma transferência da conta escolhida para o cartão.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="pay-from">Pagar com</Label>
          <Select id="pay-from" value={fromAccount} onChange={(e) => setFromAccount(e.target.value)}>
            {accounts.length === 0 && <option value="">Nenhuma conta disponível</option>}
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">Valor</Label>
            <MoneyInput id="pay-amount" value={amount} onChange={setAmount} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-date">Data</Label>
            <Input id="pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving || !fromAccount || amount <= 0}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar pagamento
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
