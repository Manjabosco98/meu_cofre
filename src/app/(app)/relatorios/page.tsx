import { makeQueryClient, ServerHydration } from "@/lib/query-utils";
import { createClient } from "@/lib/supabase/server";
import { ReportsView } from "@/components/reports/reports-view";
import {
  buildAccountRows,
  buildCategoryRows,
  buildInvestmentRows,
  buildMonthlyRows,
  buildSummary,
  collapseTransactions,
  filterTransactions,
  parseReportFilters,
  type InvestmentEntryReportInput,
  type InvestmentReportInput,
  type ReportAccount,
  type ReportCategory,
  type ReportTag,
  type ReportTransaction,
} from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const supabase = createClient();
  const filters = parseReportFilters(searchParams);

  const qc = makeQueryClient();
  const raw = await qc.fetchQuery({
    queryKey: ["reports", filters],
    queryFn: async () => {
      const [
        { data: accountsData },
        { data: categoriesData },
        { data: tagsData },
        { data: txData },
        { data: balancesData },
        { data: investmentsData },
        { data: entriesData },
      ] = await Promise.all([
        supabase.from("accounts").select("id,name,color,icon,type,archived").order("name"),
        supabase.from("categories").select("id,name,kind,parent_id,color,icon").order("name"),
        supabase.from("tags").select("id,name,color").order("name"),
        supabase
          .from("transactions")
          .select(
            "id,type,amount_cents,date,description,notes,status,account_id,category_id,transfer_group_id," +
              "account:accounts(id,name,color,icon,type,archived)," +
              "category:categories(id,name,kind,parent_id,color,icon)," +
              "transaction_tags(tag:tags(id,name,color))",
          )
          .gte("date", `${filters.from}T00:00:00Z`)
          .lte("date", `${filters.to}T23:59:59Z`)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase.rpc("get_account_balances"),
        supabase.from("investments").select("id,name,type,current_value_cents").order("created_at", { ascending: true }),
        supabase.from("investment_entries").select("investment_id,amount_cents,type"),
      ]);
      return {
        accounts: accountsData ?? [], categories: categoriesData ?? [], tags: tagsData ?? [],
        transactions: txData ?? [], balances: balancesData ?? [],
        investments: investmentsData ?? [], entries: entriesData ?? [],
      };
    },
  }) as {
    accounts: ReportAccount[]; categories: ReportCategory[]; tags: ReportTag[];
    transactions: unknown[]; balances: { account_id: string; balance_cents: number }[];
    investments: InvestmentReportInput[]; entries: InvestmentEntryReportInput[];
  };

  const accounts = raw.accounts;
  const categories = raw.categories;
  const tags = raw.tags;
  const transactions = filterTransactions(raw.transactions as unknown as ReportTransaction[], filters, categories);
  const balances = raw.balances;
  const consolidatedBalance = balances.reduce((acc, row) => acc + row.balance_cents, 0);

  const bankAccounts = accounts.filter((a) => a.type !== "credit_card");
  const creditCardAccounts = accounts.filter((a) => a.type === "credit_card");

  const summary = buildSummary(transactions, consolidatedBalance);
  const monthly = buildMonthlyRows(filters, transactions);
  const categoryRows = buildCategoryRows(transactions, categories);
  const accountRows = buildAccountRows(transactions, bankAccounts, balances);
  const investmentRows = buildInvestmentRows(raw.investments, raw.entries);
  const collapsed = collapseTransactions(transactions);

  const cardBalances = new Map(balances.map((b) => [b.account_id, b.balance_cents]));
  const creditCardRows = creditCardAccounts
    .filter((a) => !a.archived)
    .map((card) => {
      const cardTx = transactions.filter((t) => t.account_id === card.id && t.status === "cleared");
      const cardExpense = cardTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount_cents, 0);
      const cardIncome = cardTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount_cents, 0);
      const balance = cardBalances.get(card.id) ?? 0;
      return { id: card.id, name: card.name, color: card.color, icon: card.icon, expense: cardExpense, income: cardIncome, balance };
    })
    .filter((c) => c.expense > 0 || c.income > 0 || c.balance !== 0);

  return (
    <ServerHydration qc={qc}>
      <ReportsView
        filters={filters}
        accounts={bankAccounts.filter((account) => !account.archived)}
        categories={categories}
        tags={tags}
        summary={summary}
        monthly={monthly}
        categoryRows={categoryRows}
        accountRows={accountRows}
        creditCardRows={creditCardRows}
        investmentRows={investmentRows}
        transactions={collapsed}
      />
    </ServerHydration>
  );
}
