import { makeQueryClient, ServerHydration } from "@/lib/query-utils";
import { createClient } from "@/lib/supabase/server";
import { CardsView, type CardRow } from "@/components/cards/cards-view";
import type { SubscriptionRow } from "@/components/cards/subscriptions-view";
import type { LinkAccountOption } from "@/components/cards/card-form-dialog";
import { computeInvoicePeriod } from "@/lib/card-invoice";
import type { CategoryOption } from "@/components/transactions/types";
import type { Frequency } from "@/lib/recurrence";

export const dynamic = "force-dynamic";

interface RawCard {
  id: string;
  limit_cents: number;
  closing_day: number;
  due_day: number;
  brand: string | null;
  last4: string | null;
  linked_account_id: string | null;
  account: { id: string; name: string; color: string; institution: string | null } | null;
}

export default async function CartoesPage() {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);

  const qc = makeQueryClient();
  const raw = await qc.fetchQuery({
    queryKey: ["creditCards"],
    queryFn: async () => {
      const [{ data: cardsData }, { data: balances }, { data: totals }, { data: invoices }, { data: cats }, { data: accts }, { data: subsData }] =
        await Promise.all([
          supabase.from("credit_cards").select("id,limit_cents,closing_day,due_day,brand,last4,linked_account_id,account:accounts!credit_cards_account_id_fkey(id,name,color,institution)"),
          supabase.rpc("get_account_balances"),
          supabase.rpc("get_invoice_totals"),
          supabase.from("invoices").select("id,credit_card_id,period_end,status"),
          supabase.from("categories").select("id,name,kind,parent_id,color,icon").eq("kind", "expense").order("name"),
          supabase.from("accounts").select("id,name,institution").in("type", ["checking", "savings"]).eq("archived", false).order("name"),
          supabase
            .from("recurring_subscriptions")
            .select("id,description,amount_cents,frequency,interval,start_date,end_date,next_billing_date,status,category_id,credit_card_id")
            .order("next_billing_date"),
        ]);
      return { cards: cardsData ?? [], balances: balances ?? [], totals: totals ?? [], invoices: invoices ?? [], categories: cats ?? [], accounts: accts ?? [], subscriptions: subsData ?? [] };
    },
  }) as {
    cards: RawCard[];
    balances: { account_id: string; balance_cents: number }[];
    totals: { invoice_id: string; total_cents: number }[];
    invoices: { id: string; credit_card_id: string; period_end: string; status: string }[];
    categories: { id: string; name: string; kind: string; parent_id: string | null; color: string; icon: string }[];
    accounts: { id: string; name: string; institution: string | null }[];
    subscriptions: { id: string; description: string; amount_cents: number; frequency: Frequency; interval: number; start_date: string; end_date: string | null; next_billing_date: string; status: string; category_id: string | null; credit_card_id: string }[];
  };

  const balMap = new Map(raw.balances.map((b) => [b.account_id, b.balance_cents]));
  const totalMap = new Map(raw.totals.map((t) => [t.invoice_id, t.total_cents]));

  const rows: CardRow[] = raw.cards
    .filter((c) => c.account)
    .map((c) => {
      const acc = c.account!;
      const { periodEnd } = computeInvoicePeriod(c.closing_day, c.due_day, today);
      const openInvoice = raw.invoices.find(
        (iv) => iv.credit_card_id === c.id && iv.period_end === periodEnd,
      );
      const openInvoiceCents = openInvoice ? totalMap.get(openInvoice.id) ?? 0 : 0;
      return {
        cardId: c.id,
        accountId: acc.id,
        name: acc.name,
        institution: acc.institution,
        brand: c.brand,
        last4: c.last4,
        linkedAccountId: c.linked_account_id,
        color: acc.color,
        limitCents: c.limit_cents,
        closingDay: c.closing_day,
        dueDay: c.due_day,
        balanceCents: balMap.get(acc.id) ?? 0,
        openInvoiceCents,
      };
    });

  const categories: CategoryOption[] = raw.categories.map((c) => ({
    ...c,
    kind: c.kind as CategoryOption["kind"],
  }));
  const accounts: LinkAccountOption[] = raw.accounts;

  const catMap = new Map(raw.categories.map((c) => [c.id, { name: c.name, color: c.color }]));
  const cardNameMap = new Map(rows.map((r) => [r.cardId, { name: r.name, color: r.color }]));

  const subscriptions: SubscriptionRow[] = raw.subscriptions.map((s) => {
    const card = cardNameMap.get(s.credit_card_id);
    const cat = s.category_id ? catMap.get(s.category_id) : null;
    return {
      id: s.id,
      description: s.description,
      amountCents: s.amount_cents,
      frequency: s.frequency,
      interval: s.interval,
      startDate: s.start_date,
      endDate: s.end_date,
      nextBillingDate: s.next_billing_date,
      status: s.status as "active" | "paused" | "cancelled",
      categoryName: cat?.name ?? null,
      categoryColor: cat?.color ?? null,
      cardName: card?.name ?? "Cartão",
      cardColor: card?.color ?? "#64748b",
    };
  });

  return (
    <ServerHydration qc={qc}>
      <CardsView cards={rows} categories={categories} accounts={accounts} subscriptions={subscriptions} />
    </ServerHydration>
  );
}
