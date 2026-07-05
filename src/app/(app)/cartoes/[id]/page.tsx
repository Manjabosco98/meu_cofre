import { notFound } from "next/navigation";
import { makeQueryClient, ServerHydration } from "@/lib/query-utils";
import { createClient } from "@/lib/supabase/server";
import { InvoicesView, type InvoiceRow, type InvoiceTx } from "@/components/cards/invoices-view";
import { invoiceDisplayStatus } from "@/lib/card-invoice";
import type { Frequency } from "@/lib/recurrence";

export const dynamic = "force-dynamic";

export default async function CartaoDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: card } = await supabase
    .from("credit_cards")
    .select("id,closing_day,due_day,linked_account_id,account:accounts!credit_cards_account_id_fkey(id,name,color)")
    .eq("id", params.id)
    .maybeSingle();

  const account = (card?.account as unknown as { id: string; name: string; color: string } | null) ?? null;
  if (!card || !account) notFound();

  const qc = makeQueryClient();
  const raw = await qc.fetchQuery({
    queryKey: ["invoices", card.id],
    queryFn: async () => {
      const [{ data: invoices }, { data: totals }, { data: txs }, { data: accts }] = await Promise.all([
        supabase
          .from("invoices")
          .select("id,period_start,period_end,due_date,status")
          .eq("credit_card_id", card.id)
          .order("period_end", { ascending: false }),
        supabase.rpc("get_invoice_totals"),
        supabase
          .from("transactions")
          .select("id,date,description,amount_cents,invoice_id,installment_no,installment_total,recurring_subscription_id,recurring_subscription:recurring_subscriptions!transactions_recurring_subscription_id_fkey(frequency)")
          .eq("account_id", account.id)
          .not("invoice_id", "is", null)
          .order("date", { ascending: false }),
        supabase.from("accounts").select("id,name").eq("archived", false).neq("type", "credit_card").order("name"),
      ]);
      return { invoices: invoices ?? [], totals: totals ?? [], transactions: txs ?? [], accounts: accts ?? [] };
    },
  }) as {
    invoices: { id: string; period_start: string; period_end: string; due_date: string; status: string }[];
    totals: { invoice_id: string; total_cents: number }[];
    transactions: { id: string; date: string; description: string; amount_cents: number; invoice_id: string; installment_no: number | null; installment_total: number | null; recurring_subscription: { frequency: string } | null }[];
    accounts: { id: string; name: string }[];
  };

  const totalMap = new Map(raw.totals.map((t) => [t.invoice_id, t.total_cents]));
  const txByInvoice = new Map<string, InvoiceTx[]>();
  for (const t of raw.transactions) {
    if (!t.invoice_id) continue;
    const list = txByInvoice.get(t.invoice_id) ?? [];
    list.push({
      id: t.id,
      date: t.date,
      description: t.description,
      amountCents: t.amount_cents,
      installmentNo: t.installment_no,
      installmentTotal: t.installment_total,
      subscriptionFrequency: (t.recurring_subscription?.frequency as Frequency | null) ?? null,
    });
    txByInvoice.set(t.invoice_id, list);
  }

  const rows: InvoiceRow[] = raw.invoices.map((iv) => ({
    id: iv.id,
    periodStart: iv.period_start,
    periodEnd: iv.period_end,
    dueDate: iv.due_date,
    status: iv.status as InvoiceRow["status"],
    display: invoiceDisplayStatus(iv.status as "open" | "closed" | "paid", iv.period_end),
    totalCents: totalMap.get(iv.id) ?? 0,
    transactions: txByInvoice.get(iv.id) ?? [],
  }));

  return (
    <ServerHydration qc={qc}>
      <InvoicesView
        cardName={account.name}
        cardColor={account.color}
        invoices={rows}
        accounts={raw.accounts}
        defaultAccountId={card.linked_account_id}
      />
    </ServerHydration>
  );
}
