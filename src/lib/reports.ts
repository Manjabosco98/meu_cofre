import { formatBRL, formatDate } from "@/lib/format";

export type ReportTxType = "" | "income" | "expense" | "transfer";
export type ReportTxStatus = "" | "pending" | "cleared";

export interface ReportFilters {
  from: string;
  to: string;
  type: ReportTxType;
  status: ReportTxStatus;
  account: string;
  category: string;
  tag: string;
}

export interface ReportAccount {
  id: string;
  name: string;
  color: string;
  icon: string;
  type?: string;
  archived?: boolean;
}

export interface ReportCategory {
  id: string;
  name: string;
  kind: "income" | "expense";
  parent_id: string | null;
  color: string;
  icon: string;
}

export interface ReportTag {
  id: string;
  name: string;
  color: string;
}

export interface ReportTransaction {
  id: string;
  type: "income" | "expense" | "transfer";
  amount_cents: number;
  date: string;
  description: string;
  notes: string | null;
  status: "pending" | "cleared";
  account_id: string;
  category_id: string | null;
  transfer_group_id: string | null;
  account: ReportAccount | null;
  category: ReportCategory | null;
  transaction_tags: { tag: ReportTag | null }[] | null;
}

export interface MonthlyReportRow {
  key: string;
  label: string;
  income: number;
  expense: number;
  result: number;
}

export interface CategoryReportRow {
  id: string;
  name: string;
  color: string;
  icon: string;
  amount: number;
  percent: number;
}

export interface AccountReportRow {
  id: string;
  name: string;
  color: string;
  icon: string;
  income: number;
  expense: number;
  result: number;
  balance: number;
}

export interface InvestmentReportInput {
  id: string;
  name: string;
  type: string;
  current_value_cents: number;
}

export interface InvestmentEntryReportInput {
  investment_id: string;
  amount_cents: number;
  type: "deposit" | "withdraw";
}

export interface InvestmentReportRow {
  id: string;
  name: string;
  type: string;
  invested: number;
  current: number;
  result: number;
  percent: number | null;
}

export interface CollapsedTransactionRow {
  id: string;
  type: "income" | "expense" | "transfer";
  date: string;
  description: string;
  status: "pending" | "cleared";
  amount: number;
  accountLabel: string;
  categoryLabel: string;
  tagsLabel: string;
  tags: { id: string; name: string; color: string }[];
}

export interface ReportSummary {
  income: number;
  expense: number;
  result: number;
  margin: number | null;
  consolidatedBalance: number;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function ymd(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function validDateParam(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function str(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

export function parseReportFilters(
  searchParams: Record<string, string | string[] | undefined>,
  today = new Date(),
): ReportFilters {
  const defaultFrom = `${today.getFullYear()}-01-01`;
  const defaultTo = ymd(today);
  const type = str(searchParams.type);
  const status = str(searchParams.status);
  const from = str(searchParams.from);
  const to = str(searchParams.to);

  return {
    from: validDateParam(from) ? from : defaultFrom,
    to: validDateParam(to) ? to : defaultTo,
    type: type === "income" || type === "expense" || type === "transfer" ? type : "",
    status: status === "pending" || status === "cleared" ? status : "",
    account: str(searchParams.account),
    category: str(searchParams.category),
    tag: str(searchParams.tag),
  };
}

export function reportQueryString(filters: ReportFilters, extra?: Record<string, string>) {
  const params = new URLSearchParams();
  params.set("from", filters.from);
  params.set("to", filters.to);
  if (filters.type) params.set("type", filters.type);
  if (filters.status) params.set("status", filters.status);
  if (filters.account) params.set("account", filters.account);
  if (filters.category) params.set("category", filters.category);
  if (filters.tag) params.set("tag", filters.tag);
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

export function categoryFilterIds(categoryId: string, categories: ReportCategory[]) {
  if (!categoryId) return new Set<string>();
  const ids = new Set([categoryId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const cat of categories) {
      if (cat.parent_id && ids.has(cat.parent_id) && !ids.has(cat.id)) {
        ids.add(cat.id);
        changed = true;
      }
    }
  }
  return ids;
}

export function filterTransactions(
  transactions: ReportTransaction[],
  filters: ReportFilters,
  categories: ReportCategory[],
) {
  const categoryIds = categoryFilterIds(filters.category, categories);
  return transactions.filter((tx) => {
    if (filters.type && tx.type !== filters.type) return false;
    if (filters.status && tx.status !== filters.status) return false;
    if (filters.account && tx.account_id !== filters.account) return false;
    if (filters.category && (!tx.category_id || !categoryIds.has(tx.category_id))) return false;
    if (filters.tag) {
      const hasTag = (tx.transaction_tags ?? []).some((tt) => tt.tag?.id === filters.tag);
      if (!hasTag) return false;
    }
    return true;
  });
}

export function buildSummary(transactions: ReportTransaction[], consolidatedBalance: number): ReportSummary {
  let income = 0;
  let expense = 0;
  for (const tx of transactions) {
    if (tx.status !== "cleared") continue;
    if (tx.type === "income") income += tx.amount_cents;
    if (tx.type === "expense") expense += tx.amount_cents;
  }
  const result = income - expense;
  return {
    income,
    expense,
    result,
    margin: income > 0 ? result / income : null,
    consolidatedBalance,
  };
}

export function buildMonthlyRows(filters: ReportFilters, transactions: ReportTransaction[]): MonthlyReportRow[] {
  const [fy, fm] = filters.from.split("-").map(Number);
  const [ty, tm] = filters.to.split("-").map(Number);
  const rows: MonthlyReportRow[] = [];
  let cursor = new Date(fy, fm - 1, 1);
  const end = new Date(ty, tm - 1, 1);
  while (cursor <= end) {
    const key = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`;
    rows.push({
      key,
      label: new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(cursor).replace(".", ""),
      income: 0,
      expense: 0,
      result: 0,
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  const map = new Map(rows.map((row) => [row.key, row]));
  for (const tx of transactions) {
    if (tx.status !== "cleared" || tx.type === "transfer") continue;
    const d = new Date(tx.date);
    const row = map.get(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
    if (!row) continue;
    if (tx.type === "income") row.income += tx.amount_cents;
    if (tx.type === "expense") row.expense += tx.amount_cents;
  }
  for (const row of rows) row.result = row.income - row.expense;
  return rows;
}

export function buildCategoryRows(transactions: ReportTransaction[], categories: ReportCategory[]): CategoryReportRow[] {
  const catMap = new Map(categories.map((cat) => [cat.id, cat]));
  const totals = new Map<string, number>();
  const meta = new Map<string, { name: string; color: string; icon: string }>();

  for (const tx of transactions) {
    if (tx.status !== "cleared" || tx.type !== "expense") continue;
    const cat = tx.category_id ? catMap.get(tx.category_id) : null;
    const root = cat?.parent_id ? catMap.get(cat.parent_id) ?? cat : cat;
    const id = root?.id ?? "none";
    meta.set(id, {
      name: root?.name ?? "Sem categoria",
      color: root?.color ?? "#94a3b8",
      icon: root?.icon ?? "tag",
    });
    totals.set(id, (totals.get(id) ?? 0) + tx.amount_cents);
  }

  const totalExpense = [...totals.values()].reduce((acc, value) => acc + value, 0);
  return [...totals.entries()]
    .map(([id, amount]) => {
      const m = meta.get(id)!;
      return {
        id,
        ...m,
        amount,
        percent: totalExpense > 0 ? amount / totalExpense : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

export function buildAccountRows(
  transactions: ReportTransaction[],
  accounts: ReportAccount[],
  balances: { account_id: string; balance_cents: number }[],
): AccountReportRow[] {
  const map = new Map(
    accounts
      .filter((account) => !account.archived)
      .map((account) => [
        account.id,
        {
          id: account.id,
          name: account.name,
          color: account.color,
          icon: account.icon,
          income: 0,
          expense: 0,
          result: 0,
          balance: balances.find((b) => b.account_id === account.id)?.balance_cents ?? 0,
        },
      ]),
  );

  for (const tx of transactions) {
    if (tx.status !== "cleared" || tx.type === "transfer") continue;
    const row = map.get(tx.account_id);
    if (!row) continue;
    if (tx.type === "income") row.income += tx.amount_cents;
    if (tx.type === "expense") row.expense += tx.amount_cents;
  }

  for (const row of map.values()) row.result = row.income - row.expense;
  return [...map.values()].sort((a, b) => Math.abs(b.result) - Math.abs(a.result));
}

export function buildInvestmentRows(
  investments: InvestmentReportInput[],
  entries: InvestmentEntryReportInput[],
): InvestmentReportRow[] {
  const byInvestment = new Map<string, InvestmentEntryReportInput[]>();
  for (const entry of entries) {
    const list = byInvestment.get(entry.investment_id) ?? [];
    list.push(entry);
    byInvestment.set(entry.investment_id, list);
  }

  return investments
    .map((investment) => {
      const invested = (byInvestment.get(investment.id) ?? []).reduce(
        (acc, entry) => acc + (entry.type === "withdraw" ? -entry.amount_cents : entry.amount_cents),
        0,
      );
      const current = investment.current_value_cents;
      const result = current - invested;
      return {
        id: investment.id,
        name: investment.name,
        type: investment.type,
        invested,
        current,
        result,
        percent: invested > 0 ? result / invested : null,
      };
    })
    .sort((a, b) => b.current - a.current);
}

export function collapseTransactions(transactions: ReportTransaction[]): CollapsedTransactionRow[] {
  const rows: CollapsedTransactionRow[] = [];
  const pendingTransfers = new Map<string, CollapsedTransactionRow>();

  for (const tx of transactions) {
    const tags = (tx.transaction_tags ?? [])
      .map((tt) => tt.tag)
      .filter((t): t is ReportTag => t != null);
    const tagsLabel = tags.map((t) => t.name).join(", ");

    if (tx.type !== "transfer" || !tx.transfer_group_id) {
      rows.push({
        id: tx.id,
        type: tx.type,
        date: tx.date,
        description: tx.description,
        status: tx.status,
        amount: Math.abs(tx.amount_cents),
        accountLabel: tx.account?.name ?? "Conta",
        categoryLabel: tx.category?.name ?? "Sem categoria",
        tagsLabel,
        tags,
      });
      continue;
    }

    const existing = pendingTransfers.get(tx.transfer_group_id);
    const accountName = tx.account?.name ?? "Conta";
    if (!existing) {
      pendingTransfers.set(tx.transfer_group_id, {
        id: tx.transfer_group_id,
        type: "transfer",
        date: tx.date,
        description: tx.description,
        status: tx.status,
        amount: Math.abs(tx.amount_cents),
        accountLabel: tx.amount_cents < 0 ? `${accountName} → ?` : `? → ${accountName}`,
        categoryLabel: "Transferência",
        tagsLabel,
        tags,
      });
    } else {
      existing.amount = Math.max(existing.amount, Math.abs(tx.amount_cents));
      if (tx.amount_cents < 0) {
        existing.accountLabel = existing.accountLabel.replace("?", accountName);
      } else {
        existing.accountLabel = existing.accountLabel.replace("?", accountName);
      }
      rows.push(existing);
      pendingTransfers.delete(tx.transfer_group_id);
    }
  }

  for (const leftover of pendingTransfers.values()) rows.push(leftover);
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export function decimalBRL(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function csvCell(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function csvLine(values: (string | number | null | undefined)[]) {
  return values.map(csvCell).join(";");
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]) {
  return "\uFEFF" + [csvLine(headers), ...rows.map(csvLine)].join("\r\n");
}

export function transactionsCsvRows(rows: CollapsedTransactionRow[]) {
  return rows.map((row) => [
    formatDate(row.date),
    row.type === "income" ? "Receita" : row.type === "expense" ? "Despesa" : "Transferência",
    row.status === "cleared" ? "Realizado" : "Previsto",
    row.description,
    row.accountLabel,
    row.categoryLabel,
    row.tagsLabel,
    decimalBRL(row.amount),
    formatBRL(row.amount),
  ]);
}
