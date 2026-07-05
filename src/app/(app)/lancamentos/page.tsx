import { makeQueryClient, ServerHydration } from "@/lib/query-utils";
import { createClient } from "@/lib/supabase/server";
import { TransactionsView } from "@/components/transactions/transactions-view";
import type {
  AccountOption, CategoryOption, TagOption, TxItem,
} from "@/components/transactions/types";
import type { AccountType } from "@/lib/account-meta";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

interface RawAccount {
  id: string;
  name: string;
  color: string;
  icon: string;
  type: AccountType;
}
interface RawRow {
  id: string;
  type: "income" | "expense" | "transfer";
  amount_cents: number;
  valor_previsto: number;
  valor_realizado: number | null;
  date: string;
  description: string;
  notes: string | null;
  status: "pending" | "cleared";
  transfer_group_id: string | null;
  recurring_rule_id: string | null;
  account: RawAccount | null;
  category: { id: string; name: string; color: string; icon: string } | null;
  transaction_tags: { tag: TagOption | null }[] | null;
}

function str(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

export default async function LancamentosPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const supabase = createClient();

  const q = str(searchParams.q);
  const type = str(searchParams.type);
  const account = str(searchParams.account);
  const category = str(searchParams.category);
  const status = str(searchParams.status);
  const from = str(searchParams.from);
  const to = str(searchParams.to);
  const page = Math.max(1, parseInt(str(searchParams.page) || "1", 10));

  const qc = makeQueryClient();

  // Phase 1: reference data
  const optionsData = await qc.fetchQuery({
    queryKey: ["transactions", "options"],
    queryFn: async () => {
      const [{ data: accData }, { data: catData }, { data: tagData }] = await Promise.all([
        supabase.from("accounts").select("id,name,color,icon,type").eq("archived", false).neq("type", "credit_card").order("name"),
        supabase.from("categories").select("id,name,kind,parent_id,color,icon").order("name"),
        supabase.from("tags").select("id,name,color").order("name"),
      ]);
      return { accounts: accData ?? [], categories: catData ?? [], tags: tagData ?? [] };
    },
  }) as {
    accounts: AccountOption[];
    categories: CategoryOption[];
    tags: TagOption[];
  };

  // Phase 2: filtered data + summary
  const txData = await qc.fetchQuery({
    queryKey: ["transactions", "list", { q, type, account, category, status, from, to, page }],
    queryFn: async () => {
      let detailed = supabase
        .from("transactions")
        .select(
          "id,type,amount_cents,valor_previsto,valor_realizado,date,description,notes,status,transfer_group_id,recurring_rule_id," +
            "account:accounts(id,name,color,icon,type)," +
            "category:categories(id,name,color,icon)," +
            "transaction_tags(tag:tags(id,name,color))",
        )
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      let summaryQ = supabase.from("transactions").select("type,amount_cents,status", { count: "exact" });

      if (q) { detailed = detailed.ilike("description", `%${q}%`); summaryQ = summaryQ.ilike("description", `%${q}%`); }
      if (type === "income" || type === "expense" || type === "transfer") { detailed = detailed.eq("type", type); summaryQ = summaryQ.eq("type", type); }
      if (account) { detailed = detailed.eq("account_id", account); summaryQ = summaryQ.eq("account_id", account); }
      if (category) { detailed = detailed.eq("category_id", category); summaryQ = summaryQ.eq("category_id", category); }
      if (status === "pending" || status === "cleared") { detailed = detailed.eq("status", status); summaryQ = summaryQ.eq("status", status); }
      if (from) { detailed = detailed.gte("date", `${from}T00:00:00Z`); summaryQ = summaryQ.gte("date", `${from}T00:00:00Z`); }
      if (to) { detailed = detailed.lte("date", `${to}T23:59:59Z`); summaryQ = summaryQ.lte("date", `${to}T23:59:59Z`); }

      const [{ data: rowsData }, { data: sumData, count }] = await Promise.all([detailed, summaryQ]);
      return { rows: rowsData ?? [], summary: sumData ?? [], count: count ?? 0 };
    },
  }) as {
    rows: RawRow[];
    summary: { type: string; amount_cents: number; status: string }[];
    count: number;
  };

  const rows = txData.rows;

  // Phase 3: attachments
  const txIds = rows.map((r) => r.id);
  let attCountMap = new Map<string, number>();
  if (txIds.length) {
    const attData = await qc.fetchQuery({
      queryKey: ["transactions", "attachments", txIds.sort().join(",")],
      queryFn: async () => {
        const { data } = await supabase.from("attachments").select("transaction_id").in("transaction_id", txIds);
        return data ?? [];
      },
    }) as { transaction_id: string }[];
    for (const a of attData) {
      attCountMap.set(a.transaction_id, (attCountMap.get(a.transaction_id) ?? 0) + 1);
    }
  }

  let incomeCents = 0;
  let expenseCents = 0;
  for (const r of txData.summary) {
    if (r.status !== "cleared") continue;
    if (r.type === "income") incomeCents += r.amount_cents;
    else if (r.type === "expense") expenseCents += r.amount_cents;
  }

  const items: TxItem[] = [];
  const pending = new Map<string, TxItem>();

  for (const r of rows) {
    const tags_ = (r.transaction_tags ?? []).map((tt) => tt.tag).filter(Boolean) as TagOption[];

    if (r.type !== "transfer" || !r.transfer_group_id) {
      items.push({
        id: r.id, kind: r.type, amount_cents: Math.abs(r.amount_cents), date: r.date,
        description: r.description, notes: r.notes, status: r.status,
        account: r.account, category: r.category, tags: tags_,
        fromAccount: null, toAccount: null, transferGroupId: null,
        attachmentCount: attCountMap.get(r.id) ?? 0,
        valorPrevisto: r.valor_previsto, valorRealizado: r.valor_realizado,
        recurringRuleId: r.recurring_rule_id,
      });
      continue;
    }

    const existing = pending.get(r.transfer_group_id);
    if (!existing) {
      pending.set(r.transfer_group_id, {
        id: r.id, kind: "transfer", amount_cents: Math.abs(r.amount_cents), date: r.date,
        description: r.description, notes: r.notes, status: r.status,
        account: null, category: null, tags: [],
        fromAccount: r.amount_cents < 0 ? r.account : null,
        toAccount: r.amount_cents > 0 ? r.account : null,
        transferGroupId: r.transfer_group_id,
        attachmentCount: attCountMap.get(r.id) ?? 0,
        valorPrevisto: Math.abs(r.valor_previsto),
        valorRealizado: r.valor_realizado != null ? Math.abs(r.valor_realizado) : null,
        recurringRuleId: null,
      });
    } else {
      if (r.amount_cents < 0) existing.fromAccount = r.account;
      else existing.toAccount = r.account;
      existing.attachmentCount += attCountMap.get(r.id) ?? 0;
      items.push(existing);
      pending.delete(r.transfer_group_id);
    }
  }
  for (const leftover of pending.values()) items.push(leftover);

  return (
    <ServerHydration qc={qc}>
      <TransactionsView
        items={items}
        summary={{ incomeCents, expenseCents }}
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={txData.count}
        accounts={optionsData.accounts}
        categories={optionsData.categories}
        tags={optionsData.tags}
      />
    </ServerHydration>
  );
}
