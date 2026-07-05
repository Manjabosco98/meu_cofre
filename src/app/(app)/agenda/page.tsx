import { makeQueryClient, ServerHydration } from "@/lib/query-utils";
import { createClient } from "@/lib/supabase/server";
import { AgendaView, type PendingItem, type RuleItem } from "@/components/agenda/agenda-view";
import { RecurringMaterializer } from "@/components/agenda/recurring-materializer";
import type { AccountOption, CategoryOption, TagOption } from "@/components/transactions/types";
import type { Frequency } from "@/lib/recurrence";

export const dynamic = "force-dynamic";

interface RawPending {
  id: string;
  type: "income" | "expense";
  amount_cents: number;
  date: string;
  description: string;
  notes: string | null;
  account_id: string;
  category_id: string | null;
  recurring_rule_id: string | null;
  account: { name: string; color: string; icon: string } | null;
  category: { name: string; color: string; icon: string } | null;
  transaction_tags: { tag: TagOption | null }[] | null;
}
interface RawRule {
  id: string;
  type: "income" | "expense";
  description: string;
  amount_cents: number;
  account_id: string;
  category_id: string | null;
  frequency: Frequency;
  interval: number;
  next_run_date: string;
  end_date: string | null;
  occurrences: number | null;
  active: boolean;
  account: { name: string } | null;
}

export default async function AgendaPage() {
  const supabase = createClient();
  const todayStr = new Date().toISOString().slice(0, 10);

  const qc = makeQueryClient();
  const raw = await qc.fetchQuery({
    queryKey: ["agenda"],
    queryFn: async () => {
      const [{ data: pendingData }, { data: rulesData }, { data: accData }, { data: catData }, { data: tagData }] =
        await Promise.all([
          supabase
            .from("transactions")
            .select(
              "id,type,amount_cents,date,description,notes,account_id,category_id,recurring_rule_id," +
                "account:accounts(name,color,icon),category:categories(name,color,icon)," +
                "transaction_tags(tag:tags(id,name,color))",
            )
            .eq("status", "pending")
            .in("type", ["income", "expense"])
            .order("date", { ascending: true }),
          supabase
            .from("recurring_rules")
            .select("id,type,description,amount_cents,account_id,category_id,frequency,interval,next_run_date,end_date,occurrences,active,account:accounts(name)")
            .order("next_run_date", { ascending: true }),
          supabase.from("accounts").select("id,name,color,icon,type").eq("archived", false).neq("type", "credit_card").order("name"),
          supabase.from("categories").select("id,name,kind,parent_id,color,icon").order("name"),
          supabase.from("tags").select("id,name,color").order("name"),
        ]);
      return { pending: pendingData ?? [], rules: rulesData ?? [], accounts: accData ?? [], categories: catData ?? [], tags: tagData ?? [] };
    },
  }) as {
    pending: RawPending[]; rules: RawRule[];
    accounts: AccountOption[]; categories: CategoryOption[]; tags: TagOption[];
  };

  const pending: PendingItem[] = (raw.pending ?? []).map((r) => ({
    id: r.id,
    kind: r.type,
    amount_cents: r.amount_cents,
    date: r.date,
    description: r.description,
    notes: r.notes,
    account_id: r.account_id,
    account: r.account,
    category_id: r.category_id,
    category: r.category,
    tags: (r.transaction_tags ?? []).map((t) => t.tag).filter(Boolean) as TagOption[],
    fromRecurring: !!r.recurring_rule_id,
  }));

  const rules: RuleItem[] = (raw.rules ?? []).map((r) => ({
    id: r.id,
    type: r.type,
    description: r.description,
    amount_cents: r.amount_cents,
    account_id: r.account_id,
    category_id: r.category_id,
    accountName: r.account?.name ?? "",
    frequency: r.frequency,
    interval: r.interval,
    next_run_date: r.next_run_date,
    end_date: r.end_date,
    occurrences: r.occurrences,
    active: r.active,
  }));

  return (
    <ServerHydration qc={qc}>
      <>
        <RecurringMaterializer />
        <AgendaView
          pending={pending}
          rules={rules}
          accounts={raw.accounts}
          categories={raw.categories}
          tags={raw.tags}
          todayStr={todayStr}
        />
      </>
    </ServerHydration>
  );
}
