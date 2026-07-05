import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildAccountRows,
  buildCategoryRows,
  buildInvestmentRows,
  buildMonthlyRows,
  collapseTransactions,
  decimalBRL,
  filterTransactions,
  parseReportFilters,
  toCsv,
  transactionsCsvRows,
  type InvestmentEntryReportInput,
  type InvestmentReportInput,
  type ReportAccount,
  type ReportCategory,
  type ReportTransaction,
  type ReportTxType,
} from "@/lib/reports";

type ExportType = "transactions" | "monthly" | "categories" | "accounts" | "investments";

function exportType(value: string | null): ExportType {
  if (
    value === "transactions" ||
    value === "monthly" ||
    value === "categories" ||
    value === "accounts" ||
    value === "investments"
  ) {
    return value;
  }
  return "transactions";
}

function txType(value: string | null): ReportTxType {
  return value === "income" || value === "expense" || value === "transfer" ? value : "";
}

function percent(value: number | null) {
  if (value == null) return "";
  return new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 2 }).format(value);
}

function downloadResponse(csv: string, name: string) {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const kind = exportType(request.nextUrl.searchParams.get("type"));
  const filters = parseReportFilters({
    ...params,
    type: txType(request.nextUrl.searchParams.get("txType")),
  });

  const [
    { data: accountsData },
    { data: categoriesData },
    { data: txData },
    { data: balancesData },
    { data: investmentsData },
    { data: entriesData },
  ] = await Promise.all([
    supabase.from("accounts").select("id,name,color,icon,type,archived").order("name"),
    supabase.from("categories").select("id,name,kind,parent_id,color,icon").order("name"),
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

  const accounts = (accountsData ?? []) as ReportAccount[];
  const categories = (categoriesData ?? []) as ReportCategory[];
  const transactions = filterTransactions((txData ?? []) as unknown as ReportTransaction[], filters, categories);
  const balances = balancesData ?? [];
  const investments = (investmentsData ?? []) as InvestmentReportInput[];
  const investmentEntries = (entriesData ?? []) as InvestmentEntryReportInput[];
  const suffix = `${filters.from}_${filters.to}`;

  if (kind === "monthly") {
    const rows = buildMonthlyRows(filters, transactions).map((row) => [
      row.label,
      decimalBRL(row.income),
      decimalBRL(row.expense),
      decimalBRL(row.result),
    ]);
    return downloadResponse(toCsv(["Mês", "Receitas", "Despesas", "Resultado"], rows), `relatorio-mensal-${suffix}.csv`);
  }

  if (kind === "categories") {
    const rows = buildCategoryRows(transactions, categories).map((row) => [
      row.name,
      decimalBRL(row.amount),
      percent(row.percent),
    ]);
    return downloadResponse(toCsv(["Categoria", "Despesas", "Participação"], rows), `relatorio-categorias-${suffix}.csv`);
  }

  if (kind === "accounts") {
    const bankAccounts = accounts.filter((a) => a.type !== "credit_card");
    const rows = buildAccountRows(transactions, bankAccounts, balances).map((row) => [
      row.name,
      decimalBRL(row.income),
      decimalBRL(row.expense),
      decimalBRL(row.result),
      decimalBRL(row.balance),
    ]);
    return downloadResponse(toCsv(["Conta", "Entradas", "Saídas", "Resultado", "Saldo"], rows), `relatorio-contas-${suffix}.csv`);
  }

  if (kind === "investments") {
    const rows = buildInvestmentRows(investments, investmentEntries).map((row) => [
      row.name,
      row.type,
      decimalBRL(row.invested),
      decimalBRL(row.current),
      decimalBRL(row.result),
      percent(row.percent),
    ]);
    return downloadResponse(toCsv(["Investimento", "Tipo", "Investido", "Atual", "Rendimento", "Percentual"], rows), `relatorio-investimentos-${suffix}.csv`);
  }

  const rows = transactionsCsvRows(collapseTransactions(transactions));
  return downloadResponse(
    toCsv(["Data", "Tipo", "Status", "Descrição", "Conta", "Categoria", "Tags", "Valor", "Valor formatado"], rows),
    `relatorio-extrato-${suffix}.csv`,
  );
}
