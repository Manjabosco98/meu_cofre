"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Query functions para React Query.
 * Estas funções rodam no servidor (via prefetch) e no cliente (via useQuery).
 * No servidor, usam createClient() do Supabase SSR.
 * No cliente, usam Server Actions que chamam createClient() internamente.
 *
 * Cada função retorna dados serializáveis (JSON-safe) para hydration.
 */

export type DashboardData = {
  balances: { account_id: string; balance_cents: number }[];
  accountsCount: number;
  trendTx: { date: string; type: string; amount_cents: number }[];
  monthExpenses: { amount_cents: number; category_id: string | null }[];
  categories: { id: string; name: string; color: string; parent_id: string | null }[];
  upcoming: {
    id: string;
    date: string;
    type: string;
    amount_cents: number;
    description: string;
    account: { name: string; color: string; icon: string } | null;
  }[];
};

export async function fetchDashboardData(meses: number): Promise<DashboardData> {
  const supabase = createClient();

  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - (meses - 1), 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [
    { data: balances },
    { count: accountsCount },
    { data: trendTx },
    { data: monthExpenses },
    { data: categories },
    { data: upcoming },
  ] = await Promise.all([
    supabase.rpc("get_account_balances"),
    supabase.from("accounts").select("id", { count: "exact", head: true }).eq("archived", false),
    supabase
      .from("transactions")
      .select("date,type,amount_cents")
      .eq("status", "cleared")
      .in("type", ["income", "expense"])
      .gte("date", rangeStart.toISOString()),
    supabase
      .from("transactions")
      .select("amount_cents,category_id")
      .eq("status", "cleared")
      .eq("type", "expense")
      .gte("date", monthStart.toISOString())
      .lte("date", monthEnd.toISOString()),
    supabase.from("categories").select("id,name,color,parent_id"),
    supabase
      .from("transactions")
      .select("id,date,type,amount_cents,description,account:accounts(name,color,icon)")
      .eq("status", "pending")
      .order("date", { ascending: true })
      .limit(8),
  ]);

  return {
    balances: balances ?? [],
    accountsCount: accountsCount ?? 0,
    trendTx: trendTx ?? [],
    monthExpenses: monthExpenses ?? [],
    categories: categories ?? [],
    upcoming: (upcoming ?? []) as unknown as DashboardData["upcoming"],
  };
}

export type AccountsPageData = {
  accounts: unknown[];
  balances: { account_id: string; balance_cents: number }[];
  goals: { id: string; account_id: string | null }[];
  contributions: { goal_id: string; amount_cents: number }[];
};

export async function fetchAccountsPageData(): Promise<AccountsPageData> {
  const supabase = createClient();

  const [{ data: accounts }, { data: balances }, { data: goals }, { data: contributions }] =
    await Promise.all([
      supabase
        .from("accounts")
        .select("*")
        .neq("type", "credit_card")
        .eq("archived", false)
        .order("name"),
      supabase.rpc("get_account_balances"),
      supabase.from("goals").select("id,account_id").not("account_id", "is", null),
      supabase.from("goal_contributions").select("goal_id,amount_cents"),
    ]);

  return {
    accounts: accounts ?? [],
    balances: balances ?? [],
    goals: goals ?? [],
    contributions: contributions ?? [],
  };
}

export type CategoriesPageData = {
  categories: unknown[];
  tags: unknown[];
};

export async function fetchCategoriesPageData(): Promise<CategoriesPageData> {
  const supabase = createClient();

  const [{ data: categories }, { data: tags }] = await Promise.all([
    supabase.from("categories").select("id,name,kind,parent_id,color,icon").order("name"),
    supabase.from("tags").select("id,name,color").order("name"),
  ]);

  return {
    categories: categories ?? [],
    tags: tags ?? [],
  };
}

export type GoalsPageData = {
  goals: unknown[];
  contributions: unknown[];
  accounts: { id: string; name: string }[];
};

export async function fetchGoalsPageData(): Promise<GoalsPageData> {
  const supabase = createClient();

  const [{ data: goals }, { data: contributions }, { data: accounts }] = await Promise.all([
    supabase
      .from("goals")
      .select("id,name,target_cents,deadline,color,status,recurring_contribution_cents,contribution_frequency,start_date,account_id,created_at,updated_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("goal_contributions")
      .select("id,goal_id,amount_cents,date,note,type")
      .order("date", { ascending: false }),
    supabase
      .from("accounts")
      .select("id,name")
      .eq("archived", false)
      .order("name"),
  ]);

  return {
    goals: goals ?? [],
    contributions: contributions ?? [],
    accounts: accounts ?? [],
  };
}

export type InvestmentsPageData = {
  investments: unknown[];
  entries: unknown[];
};

export async function fetchInvestmentsPageData(): Promise<InvestmentsPageData> {
  const supabase = createClient();

  const [{ data: investments }, { data: entries }] = await Promise.all([
    supabase
      .from("investments")
      .select("id,name,type,current_value_cents,updated_at")
      .order("name"),
    supabase
      .from("investment_entries")
      .select("id,investment_id,amount_cents,type,date,note")
      .order("date", { ascending: false }),
  ]);

  return {
    investments: investments ?? [],
    entries: entries ?? [],
  };
}

export type CashflowPageData = {
  balances: { account_id: string; balance_cents: number }[];
  transactions: unknown[];
};

export async function fetchCashflowPageData(
  rangeStart: string,
  rangeEnd: string,
): Promise<CashflowPageData> {
  const supabase = createClient();

  const [{ data: balances }, { data: transactions }] = await Promise.all([
    supabase.rpc("get_account_balances"),
    supabase
      .from("transactions")
      .select("id,date,type,amount_cents,status,description,account_id,category_id")
      .in("type", ["income", "expense"])
      .gte("date", rangeStart)
      .lte("date", rangeEnd)
      .order("date", { ascending: true }),
  ]);

  return {
    balances: balances ?? [],
    transactions: transactions ?? [],
  };
}

export type NotificationsPageData = {
  notifications: unknown[];
};

export async function fetchNotificationsPageData(): Promise<NotificationsPageData> {
  const supabase = createClient();

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id,type,related_id,title,body,read_at,created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return {
    notifications: notifications ?? [],
  };
}

export type ImportsPageData = {
  accounts: unknown[];
  batches: unknown[];
  cards: unknown[];
};

export async function fetchImportsPageData(): Promise<ImportsPageData> {
  const supabase = createClient();

  const [{ data: accounts }, { data: batches }, { data: cards }] = await Promise.all([
    supabase
      .from("accounts")
      .select("id,name,type,institution,color,icon")
      .neq("type", "credit_card")
      .order("name"),
    supabase
      .from("import_batches")
      .select("id,file_name,source,imported_count,duplicate_count,created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("credit_cards")
      .select("id,account_id,brand,last4,limit_cents")
      .order("created_at", { ascending: false }),
  ]);

  return {
    accounts: accounts ?? [],
    batches: batches ?? [],
    cards: cards ?? [],
  };
}
