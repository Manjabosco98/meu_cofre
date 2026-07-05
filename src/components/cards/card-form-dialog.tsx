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
import { ColorPicker } from "@/components/color-picker";
import { deriveCardLabel } from "@/lib/card-label";
import { bankName } from "@/lib/banks";
import type { CardInput } from "@/lib/zod-schemas/card";
import { createCard, updateCard } from "@/app/(app)/cartoes/actions";

export interface LinkAccountOption {
  id: string;
  name: string;
  institution: string | null;
}

export interface CardData {
  cardId: string;
  accountId: string;
  name: string;
  institution: string | null;
  brand: string | null;
  last4: string | null;
  linkedAccountId: string | null;
  limitCents: number;
  closingDay: number;
  dueDay: number;
  color: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  card: CardData | null;
  accounts: LinkAccountOption[];
}

export function CardFormDialog({ open, onClose, card, accounts }: Props) {
  const router = useRouter();
  const [linkedAccount, setLinkedAccount] = useState(card?.linkedAccountId ?? "");
  const [institution, setInstitution] = useState(card?.institution ?? "");
  const [brand, setBrand] = useState(card?.brand ?? "");
  const [last4, setLast4] = useState(card?.last4 ?? "");
  const [limit, setLimit] = useState(card?.limitCents ?? 0);
  const [closingDay, setClosingDay] = useState(card?.closingDay ?? 1);
  const [dueDay, setDueDay] = useState(card?.dueDay ?? 10);
  const [apelido, setApelido] = useState(card?.name ?? "");
  const [color, setColor] = useState(card?.color ?? "#8b5cf6");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Banco efetivo = herdado da conta vinculada (guarda slug) ou o digitado (texto).
  // bankName() resolve slug→nome para o rótulo humano.
  const linkedInstitution = bankName(accounts.find((a) => a.id === linkedAccount)?.institution);
  const effectiveInstitution = linkedAccount ? linkedInstitution : institution;
  const autoApelido = deriveCardLabel(effectiveInstitution, last4);

  // Apelido editado manualmente? Em edição, deduz comparando o nome salvo ao derivado.
  const [apelidoTouched, setApelidoTouched] = useState(false);

  // Reinicializa o formulário sempre que o modal abre: em "novo" (card=null) começa
  // limpo; em "editar" preenche com o cartão clicado. Evita vazar o estado da última
  // abertura (ex.: reabrir "Novo cartão" mostrando o cartão recém-criado).
  useEffect(() => {
    if (!open) return;
    setLinkedAccount(card?.linkedAccountId ?? "");
    setInstitution(card?.institution ?? "");
    setBrand(card?.brand ?? "");
    setLast4(card?.last4 ?? "");
    setLimit(card?.limitCents ?? 0);
    setClosingDay(card?.closingDay ?? 1);
    setDueDay(card?.dueDay ?? 10);
    setApelido(card?.name ?? "");
    setColor(card?.color ?? "#8b5cf6");
    setApelidoTouched(
      card
        ? (card.name ?? "") !==
            deriveCardLabel(
              card.linkedAccountId
                ? bankName(accounts.find((a) => a.id === card.linkedAccountId)?.institution)
                : card.institution ?? "",
              card.last4,
            )
        : false,
    );
    setError(null);
    setSaving(false);
    // accounts é prop estável; reset deve rodar por abertura/cartão.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, card]);

  // Enquanto o usuário não editar o apelido, ele acompanha banco + final.
  useEffect(() => {
    if (!apelidoTouched) setApelido(autoApelido);
  }, [autoApelido, apelidoTouched]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload: CardInput = {
        apelido: apelido.trim() || null,
        institution: linkedAccount ? null : institution.trim() || null,
        brand: brand || null,
        last4: last4 || null,
        linked_account_id: linkedAccount || null,
        limit_cents: limit,
        closing_day: closingDay,
        due_day: dueDay,
        color,
      };
      const res = card ? await updateCard(card.cardId, card.accountId, payload) : await createCard(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
      onClose();
    } catch (err) {
      console.error("Falha ao salvar cartão:", err);
      setError(err instanceof Error ? err.message : "Erro inesperado ao salvar o cartão.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={card ? "Editar cartão" : "Novo cartão"}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="c-linked">Conta vinculada (pagamento da fatura)</Label>
          <Select id="c-linked" value={linkedAccount} onChange={(e) => setLinkedAccount(e.target.value)}>
            <option value="">Nenhuma (escolher ao pagar)</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">
            {linkedAccount
              ? `Banco herdado da conta${linkedInstitution ? `: ${linkedInstitution}` : ""}. Origem padrão ao pagar a fatura.`
              : "Conta corrente/poupança usada como origem padrão ao pagar a fatura."}
          </p>
        </div>

        {/* Banco só aparece quando não há conta vinculada (senão é herdado). */}
        {!linkedAccount && (
          <div className="space-y-1.5">
            <Label htmlFor="c-institution">Instituição / Banco</Label>
            <Input id="c-institution" value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Nubank, Itaú…" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="c-brand">Bandeira</Label>
            <Input id="c-brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Visa, Master…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-last4">Final do cartão</Label>
            <Input
              id="c-last4"
              inputMode="numeric"
              maxLength={4}
              value={last4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="1234"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="c-limit">Limite total</Label>
          <MoneyInput id="c-limit" value={limit} onChange={setLimit} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="c-close">Dia de fechamento</Label>
            <Input id="c-close" type="number" min={1} max={31} value={closingDay}
              onChange={(e) => setClosingDay(parseInt(e.target.value || "1", 10))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-due">Dia de vencimento</Label>
            <Input id="c-due" type="number" min={1} max={31} value={dueDay}
              onChange={(e) => setDueDay(parseInt(e.target.value || "1", 10))} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="c-apelido">Apelido</Label>
          <Input
            id="c-apelido"
            value={apelido}
            onChange={(e) => { setApelido(e.target.value); setApelidoTouched(true); }}
            placeholder={autoApelido}
          />
          <p className="text-xs text-muted-foreground">Sugerido automaticamente (banco + final). Você pode editar; é o rótulo do card.</p>
        </div>

        <div className="space-y-1.5">
          <Label>Cor</Label>
          <ColorPicker value={color} onChange={setColor} />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {card ? "Salvar" : "Criar cartão"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
