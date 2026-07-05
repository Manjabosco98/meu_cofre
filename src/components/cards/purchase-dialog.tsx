"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { MoneyInput } from "@/components/money-input";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FREQUENCY_LABELS, type Frequency } from "@/lib/recurrence";
import type { CategoryOption } from "@/components/transactions/types";
import type { PurchaseInput } from "@/lib/zod-schemas/card";
import { createCardPurchase, createCardSubscription } from "@/app/(app)/cartoes/actions";

interface CardOpt {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  cards: CardOpt[];
  categories: CategoryOption[];
  defaultCardId?: string;
}

const today = () => new Date().toISOString().slice(0, 10);

export function PurchaseDialog({ open, onClose, cards, categories, defaultCardId }: Props) {
  const router = useRouter();
  const [cardId, setCardId] = useState(defaultCardId ?? cards[0]?.id ?? "");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [installments, setInstallments] = useState(1);
  const [isRecurring, setIsRecurring] = useState(false);
  const [subFrequency, setSubFrequency] = useState<Frequency>("monthly");
  const [subEndDate, setSubEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const parents = categories.filter((c) => c.kind === "expense" && !c.parent_id);
  const perParcel = !isRecurring && installments > 1 && amount > 0
    ? Math.floor(amount / installments)
    : 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const basePayload = {
      card_id: cardId,
      amount_cents: amount,
      date,
      description,
      category_id: categoryId || null,
      installments,
      is_recurring: false,
    };

    let res;
    if (isRecurring) {
      const payload: PurchaseInput = {
        ...basePayload,
        installments: 1,
        is_recurring: true,
        subscription_frequency: subFrequency,
        subscription_end_date: subEndDate || null,
        subscription_status: "active",
      };
      res = await createCardSubscription(payload);
    } else {
      res = await createCardPurchase(basePayload);
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
    <Dialog open={open} onClose={onClose} title="Nova compra no cartão">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="p-card">Cartão</Label>
          <Select id="p-card" value={cardId} onChange={(e) => setCardId(e.target.value)}>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="p-amount">Valor total</Label>
            <MoneyInput id="p-amount" value={amount} onChange={setAmount} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-date">Data</Label>
            <Input id="p-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="p-desc">Descrição</Label>
          <Input id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} autoFocus />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="p-cat">Categoria</Label>
            <Select id="p-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
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
          {!isRecurring && (
            <div className="space-y-1.5">
              <Label htmlFor="p-inst">Parcelas</Label>
              <Input id="p-inst" type="number" min={1} max={60} value={installments}
                onChange={(e) => setInstallments(Math.max(1, parseInt(e.target.value || "1", 10)))} />
            </div>
          )}
        </div>

        {/* Valor da parcela (somente leitura) */}
        {!isRecurring && installments > 1 && perParcel > 0 && (
          <div className="space-y-1.5">
            <Label>Valor da parcela</Label>
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">{installments}x de </span>
              <strong className="text-foreground">{formatBRL(perParcel)}</strong>
              <span className="text-muted-foreground"> — uma parcela por fatura, a partir da data.</span>
            </div>
          </div>
        )}

        {/* Toggle assinatura recorrente */}
        <div className="flex items-center gap-3 rounded-md border p-3">
          <button
            type="button"
            role="switch"
            aria-checked={isRecurring}
            onClick={() => {
              setIsRecurring(!isRecurring);
              if (!isRecurring) setInstallments(1);
            }}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
              isRecurring ? "bg-primary" : "bg-muted",
            )}
          >
            <span
              className={cn(
                "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
                isRecurring ? "translate-x-4" : "translate-x-0",
              )}
            />
          </button>
          <div>
            <p className="text-sm font-medium">É uma assinatura recorrente?</p>
            <p className="text-xs text-muted-foreground">Gera cobranças automáticas no cartão</p>
          </div>
        </div>

        {/* Campos de assinatura */}
        {isRecurring && (
          <div className="space-y-3 rounded-md border p-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-freq">Frequência</Label>
                <Select id="p-freq" value={subFrequency} onChange={(e) => setSubFrequency(e.target.value as Frequency)}>
                  {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-sub-end">Data de término</Label>
                <Input id="p-sub-end" type="date" value={subEndDate}
                  onChange={(e) => setSubEndDate(e.target.value)} />
                <p className="text-[10px] text-muted-foreground">Opcional. Vazio = ativo por tempo indeterminado.</p>
              </div>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving || !description.trim() || amount <= 0 || !cardId}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isRecurring ? "Criar assinatura" : "Lançar compra"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
