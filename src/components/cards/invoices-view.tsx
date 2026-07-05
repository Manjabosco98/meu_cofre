"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronDown, ChevronRight, ReceiptText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PayInvoiceDialog } from "@/components/cards/pay-invoice-dialog";
import { formatBRL, formatDate } from "@/lib/format";
import { FREQUENCY_LABELS, type Frequency } from "@/lib/recurrence";
import { cn } from "@/lib/utils";

export interface InvoiceTx {
  id: string;
  date: string;
  description: string;
  amountCents: number;
  installmentNo: number | null;
  installmentTotal: number | null;
  subscriptionFrequency: Frequency | null;
}
export interface InvoiceRow {
  id: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: "open" | "closed" | "paid";
  display: "aberta" | "fechada" | "paga";
  totalCents: number;
  transactions: InvoiceTx[];
}

const STATUS_STYLE: Record<string, string> = {
  aberta: "border-primary/40 bg-primary/10 text-primary",
  fechada: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  paga: "border-success/40 bg-success/10 text-success",
};

interface Props {
  cardName: string;
  cardColor: string;
  invoices: InvoiceRow[];
  accounts: { id: string; name: string }[];
  defaultAccountId: string | null;
}

export function InvoicesView({ cardName, cardColor, invoices, accounts, defaultAccountId }: Props) {
  const [openId, setOpenId] = useState<string | null>(invoices[0]?.id ?? null);
  const [payInv, setPayInv] = useState<InvoiceRow | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/cartoes" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Cartões
        </Link>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg" style={{ backgroundColor: cardColor }} />
          <h1 className="text-2xl font-bold tracking-tight">{cardName}</h1>
        </div>
      </div>

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <ReceiptText className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Nenhuma fatura ainda</p>
            <p className="text-sm text-muted-foreground">Lance uma compra no cartão para gerar a fatura.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => {
            const expanded = openId === inv.id;
            return (
              <Card key={inv.id}>
                <button
                  className="flex w-full items-center gap-3 p-4 text-left"
                  onClick={() => setOpenId(expanded ? null : inv.id)}
                >
                  {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">Fatura de {formatDate(inv.periodEnd)}</p>
                      <Badge className={STATUS_STYLE[inv.display]}>{inv.display}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)} · vence {formatDate(inv.dueDate)}
                    </p>
                  </div>
                  <p className="tabular font-bold">{formatBRL(inv.totalCents)}</p>
                </button>

                {expanded && (
                  <CardContent className="border-t pt-3">
                    {inv.transactions.length === 0 ? (
                      <p className="py-3 text-sm text-muted-foreground">Sem lançamentos nesta fatura.</p>
                    ) : (
                      <ul className="divide-y">
                        {inv.transactions.map((t) => (
                          <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate font-medium">{t.description}</span>
                                {t.installmentNo && t.installmentTotal && (
                                  <Badge className="shrink-0 border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                    {t.installmentNo}/{t.installmentTotal}
                                  </Badge>
                                )}
                                {t.subscriptionFrequency && (
                                  <Badge className="shrink-0 border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400">
                                    {FREQUENCY_LABELS[t.subscriptionFrequency]}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground">{formatDate(t.date)}</span>
                            <span className="tabular w-24 text-right font-medium">{formatBRL(t.amountCents)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-3 flex items-center justify-between border-t pt-3">
                      <span className="text-sm text-muted-foreground">
                        Total <span className="tabular font-semibold text-foreground">{formatBRL(inv.totalCents)}</span>
                      </span>
                      {inv.status === "paid" ? (
                        <span className="inline-flex items-center gap-1 text-sm text-success">
                          <CheckCircle2 className="h-4 w-4" /> Paga
                        </span>
                      ) : (
                        <Button size="sm" onClick={() => setPayInv(inv)} disabled={inv.totalCents <= 0}>
                          Pagar fatura
                        </Button>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <PayInvoiceDialog
        key={payInv?.id ?? "none"}
        open={!!payInv}
        onClose={() => setPayInv(null)}
        invoiceId={payInv?.id ?? null}
        totalCents={payInv?.totalCents ?? 0}
        accounts={accounts}
        defaultAccountId={defaultAccountId}
      />
    </div>
  );
}
