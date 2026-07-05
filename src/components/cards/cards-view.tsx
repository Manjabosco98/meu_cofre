"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, CreditCard, ShoppingCart, ReceiptText, RefreshCw, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { CardFormDialog, type CardData, type LinkAccountOption } from "@/components/cards/card-form-dialog";
import { PurchaseDialog } from "@/components/cards/purchase-dialog";
import { ImportInvoiceDialog } from "@/components/cards/import-invoice-dialog";
import { SubscriptionsView, type SubscriptionRow } from "@/components/cards/subscriptions-view";
import { deleteCard, materializeSubscriptions } from "@/app/(app)/cartoes/actions";
import { formatBRL } from "@/lib/format";
import { bankName } from "@/lib/banks";
import { cn } from "@/lib/utils";
import type { CategoryOption } from "@/components/transactions/types";

export interface CardRow {
  cardId: string;
  accountId: string;
  name: string;
  institution: string | null;
  brand: string | null;
  last4: string | null;
  linkedAccountId: string | null;
  color: string;
  limitCents: number;
  closingDay: number;
  dueDay: number;
  balanceCents: number; // negativo = dívida
  openInvoiceCents: number;
}

export function CardsView({
  cards,
  categories,
  accounts,
  subscriptions,
}: {
  cards: CardRow[];
  categories: CategoryOption[];
  accounts: LinkAccountOption[];
  subscriptions?: SubscriptionRow[];
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CardData | null>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchaseCard, setPurchaseCard] = useState<string | undefined>(undefined);
  const [toDelete, setToDelete] = useState<CardRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"cards" | "subscriptions">("cards");
  const [importCardId, setImportCardId] = useState<string | undefined>(undefined);
  const [importOpen, setImportOpen] = useState(false);

  const cardOpts = cards.map((c) => ({ id: c.cardId, name: c.name }));

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(c: CardRow) {
    setEditing({
      cardId: c.cardId, accountId: c.accountId, name: c.name,
      institution: c.institution, brand: c.brand, last4: c.last4,
      linkedAccountId: c.linkedAccountId,
      limitCents: c.limitCents, closingDay: c.closingDay, dueDay: c.dueDay, color: c.color,
    });
    setFormOpen(true);
  }
  function openPurchase(cardId?: string) {
    setPurchaseCard(cardId);
    setPurchaseOpen(true);
  }
  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(true);
    await deleteCard(toDelete.accountId);
    setBusy(false);
    setToDelete(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cartões e faturas</h1>
          <p className="mt-1 text-muted-foreground">Limite, fatura atual e vencimentos.</p>
        </div>
        <div className="flex gap-2">
          {cards.length > 0 && (
            <Button variant="outline" onClick={() => openPurchase()} className="gap-2">
              <ShoppingCart className="h-4 w-4" /> Nova compra
            </Button>
          )}
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Novo cartão
          </Button>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setTab("cards")}
          className={cn(
            "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition",
            tab === "cards"
              ? "border-primary bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent",
          )}
        >
          <CreditCard className="h-3.5 w-3.5" /> Cartões
        </button>
        <button
          type="button"
          onClick={() => setTab("subscriptions")}
          className={cn(
            "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition",
            tab === "subscriptions"
              ? "border-primary bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent",
          )}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Assinaturas
          {subscriptions && subscriptions.length > 0 && (
            <span className="ml-1 rounded-full bg-primary/20 px-1.5 text-[10px] font-bold text-primary">
              {subscriptions.length}
            </span>
          )}
        </button>
      </div>

      {tab === "cards" && (cards.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <CreditCard className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium">Nenhum cartão cadastrado</p>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Novo cartão
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => {
            const usedCents = Math.max(0, -c.balanceCents); // dívida total do cartão (saldo negativo)
            const available = c.limitCents + c.balanceCents; // limite total − dívida total
            const usedPct = c.limitCents > 0 ? Math.min(100, Math.round((usedCents / c.limitCents) * 100)) : 0;
            return (
              <div key={c.cardId} className="overflow-hidden rounded-xl border">
                {/* "cartão" visual */}
                <div className="p-4 text-white" style={{ background: `linear-gradient(135deg, ${c.color}, ${c.color}cc)` }}>
                  <div className="flex items-start justify-between">
                    <CreditCard className="h-6 w-6 opacity-90" />
                    <span className="text-xs uppercase tracking-wide opacity-90">{c.brand ?? "Cartão"}</span>
                  </div>
                  <p className="mt-4 text-lg font-semibold">{c.name}</p>
                  <div className="mt-0.5 flex items-center justify-between text-xs opacity-90">
                    <span>{bankName(c.institution)}</span>
                    {c.last4 && <span className="tabular tracking-widest">•••• {c.last4}</span>}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs opacity-90">
                    <span>Fecha dia {c.closingDay}</span>
                    <span>Vence dia {c.dueDay}</span>
                  </div>
                </div>

                <div className="space-y-3 p-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Fatura atual</p>
                      <p className="tabular text-xl font-bold">{formatBRL(c.openInvoiceCents)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Limite disponível</p>
                      <p className={`tabular font-semibold ${available < 0 ? "text-destructive" : ""}`}>{formatBRL(available)}</p>
                    </div>
                  </div>

                  <div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${usedPct}%`, backgroundColor: c.color }} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Limite total {formatBRL(c.limitCents)} · {usedPct}% usado
                    </p>
                  </div>

                  <div className="flex gap-1 border-t pt-2">
                    <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => openPurchase(c.cardId)}>
                      <ShoppingCart className="h-3.5 w-3.5" /> Compra
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => { setImportCardId(c.cardId); setImportOpen(true); }}>
                      <FileUp className="h-3.5 w-3.5" /> Importar
                    </Button>
                    <Link
                      href={`/cartoes/${c.cardId}`}
                      className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <ReceiptText className="h-3.5 w-3.5" /> Faturas
                    </Link>
                    <Button variant="ghost" size="icon" className="ml-auto" aria-label="Editar" onClick={() => openEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" aria-label="Excluir" onClick={() => setToDelete(c)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {tab === "subscriptions" && (
        <SubscriptionsView subscriptions={subscriptions ?? []} />
      )}

      <CardFormDialog key={editing?.cardId ?? "new"} open={formOpen} onClose={() => setFormOpen(false)} card={editing} accounts={accounts} />
      <PurchaseDialog
        key={`purchase-${purchaseCard ?? "any"}-${purchaseOpen}`}
        open={purchaseOpen}
        onClose={() => setPurchaseOpen(false)}
        cards={cardOpts}
        categories={categories}
        defaultCardId={purchaseCard}
      />
      <ImportInvoiceDialog
        key={`import-${importCardId ?? "any"}-${importOpen}`}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        cards={cardOpts}
        defaultCardId={importCardId}
      />

      <Dialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Excluir cartão"
        description="Remove o cartão, suas faturas e todos os lançamentos vinculados."
      >
        <p className="mb-4 text-sm">Excluir <strong>{toDelete?.name}</strong>?</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setToDelete(null)}>Cancelar</Button>
          <Button variant="destructive" onClick={confirmDelete} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Excluir
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
