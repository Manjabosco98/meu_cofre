"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Download, Filter, Printer, Tags, Wallet, TrendingDown, TrendingUp, Scale, Percent, Landmark, CreditCard,
} from "lucide-react";
import { IncomeExpenseChart, CategoryDonut } from "@/components/dashboard/lazy-charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Icon } from "@/components/lucide-icon";
import { formatBRL, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  type AccountReportRow,
  type CategoryReportRow,
  type CollapsedTransactionRow,
  type InvestmentReportRow,
  type MonthlyReportRow,
  type ReportAccount,
  type ReportCategory,
  type ReportFilters,
  type ReportSummary,
  type ReportTag,
  reportQueryString,
} from "@/lib/reports";

interface Props {
  filters: ReportFilters;
  accounts: ReportAccount[];
  categories: ReportCategory[];
  tags: ReportTag[];
  summary: ReportSummary;
  monthly: MonthlyReportRow[];
  categoryRows: CategoryReportRow[];
  accountRows: AccountReportRow[];
  creditCardRows: { id: string; name: string; color: string; icon: string; expense: number; income: number; balance: number }[];
  investmentRows: InvestmentReportRow[];
  transactions: CollapsedTransactionRow[];
}

const EXPORTS = [
  ["transactions", "Extrato"],
  ["monthly", "Mensal"],
  ["categories", "Categorias"],
  ["accounts", "Contas"],
  ["investments", "Investimentos"],
] as const;

function percent(value: number | null) {
  if (value == null) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

function txTypeLabel(type: CollapsedTransactionRow["type"]) {
  if (type === "income") return "Receita";
  if (type === "expense") return "Despesa";
  return "Transferência";
}

function statusLabel(status: CollapsedTransactionRow["status"]) {
  return status === "cleared" ? "Realizado" : "Previsto";
}

export function ReportsView({
  filters,
  accounts,
  categories,
  tags,
  summary,
  monthly,
  categoryRows,
  accountRows,
  creditCardRows,
  investmentRows,
  transactions,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [local, setLocal] = useState(filters);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    router.push(`${pathname}?${reportQueryString(local)}`);
  }

  function setPeriod(from: string, to: string) {
    const next = { ...local, from, to };
    setLocal(next);
    router.push(`${pathname}?${reportQueryString(next)}`);
  }

  function exportHref(kind: (typeof EXPORTS)[number][0]) {
    const params = new URLSearchParams(reportQueryString(filters));
    const txType = params.get("type");
    params.delete("type");
    if (txType) params.set("txType", txType);
    params.set("type", kind);
    params.set("format", "csv");
    return `/relatorios/export?${params.toString()}`;
  }

  const now = new Date();
  const thisMonthFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const thisYearFrom = `${now.getFullYear()}-01-01`;
  const donutData = categoryRows.slice(0, 8).map((row) => ({
    name: row.name,
    value: row.amount,
    color: row.color,
  }));

  const cards = [
    { label: "Receitas", value: formatBRL(summary.income), icon: TrendingUp, tone: "text-success" },
    { label: "Despesas", value: formatBRL(summary.expense), icon: TrendingDown, tone: "text-destructive" },
    { label: "Resultado", value: formatBRL(summary.result), icon: Scale, tone: summary.result < 0 ? "text-destructive" : "text-success" },
    { label: "Margem", value: percent(summary.margin), icon: Percent, tone: "" },
    { label: "Saldo consolidado", value: formatBRL(summary.consolidatedBalance), icon: Wallet, tone: summary.consolidatedBalance < 0 ? "text-destructive" : "" },
  ];

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
          <p className="mt-1 text-muted-foreground print:text-xs">
            {formatDate(filters.from + "T12:00:00Z")} até {formatDate(filters.to + "T12:00:00Z")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="outline" onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" /> Salvar PDF
          </Button>
          {EXPORTS.map(([kind, label]) => (
            <a
              key={kind}
              href={exportHref(kind)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Download className="h-4 w-4" /> CSV {label}
            </a>
          ))}
        </div>
      </div>

      <Card className="print:hidden">
        <CardContent className="p-4">
          <form onSubmit={submit} className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setPeriod(thisMonthFrom, today)}
                className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-accent"
              >
                Este mês
              </button>
              <button
                type="button"
                onClick={() => setPeriod(thisYearFrom, today)}
                className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-accent"
              >
                Este ano
              </button>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div className="flex items-end gap-1">
                <Input
                  type="date"
                  value={local.from}
                  onChange={(e) => setLocal((prev) => ({ ...prev, from: e.target.value }))}
                  className="w-auto"
                />
                <span className="pb-2 text-muted-foreground">-</span>
                <Input
                  type="date"
                  value={local.to}
                  onChange={(e) => setLocal((prev) => ({ ...prev, to: e.target.value }))}
                  className="w-auto"
                />
              </div>

              <Select value={local.type} onChange={(e) => setLocal((prev) => ({ ...prev, type: e.target.value as ReportFilters["type"] }))} className="w-auto min-w-[130px]">
                <option value="">Todos os tipos</option>
                <option value="income">Receitas</option>
                <option value="expense">Despesas</option>
                <option value="transfer">Transferências</option>
              </Select>

              <Select value={local.status} onChange={(e) => setLocal((prev) => ({ ...prev, status: e.target.value as ReportFilters["status"] }))} className="w-auto min-w-[120px]">
                <option value="">Todos</option>
                <option value="cleared">Realizados</option>
                <option value="pending">Previstos</option>
              </Select>

              <Select value={local.account} onChange={(e) => setLocal((prev) => ({ ...prev, account: e.target.value }))} className="w-auto min-w-[150px]">
                <option value="">Todas as contas</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </Select>

              <Select value={local.category} onChange={(e) => setLocal((prev) => ({ ...prev, category: e.target.value }))} className="w-auto min-w-[160px]">
                <option value="">Todas as categorias</option>
                {categories.filter((cat) => !cat.parent_id).map((parent) => (
                  <optgroup key={parent.id} label={parent.name}>
                    <option value={parent.id}>{parent.name}</option>
                    {categories.filter((cat) => cat.parent_id === parent.id).map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </optgroup>
                ))}
              </Select>

              <Select value={local.tag} onChange={(e) => setLocal((prev) => ({ ...prev, tag: e.target.value }))} className="w-auto min-w-[130px]">
                <option value="">Todas as tags</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>{tag.name}</option>
                ))}
              </Select>

              <Button type="submit" className="gap-2">
                <Filter className="h-4 w-4" /> Aplicar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 print:grid-cols-5">
        {cards.map((card) => {
          const CardIcon = card.icon;
          return (
            <Card key={card.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <CardIcon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className={cn("tabular mt-1 text-xl font-bold", card.tone)}>{card.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Receitas × despesas</CardTitle></CardHeader>
          <CardContent>
            <IncomeExpenseChart data={monthly} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Despesas por categoria</CardTitle></CardHeader>
          <CardContent>
            {donutData.length ? (
              <CategoryDonut data={donutData} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">Sem despesas realizadas no período.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Resultado por conta</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Conta</th>
                    <th className="px-4 py-2 text-right font-medium">Entradas</th>
                    <th className="px-4 py-2 text-right font-medium">Saídas</th>
                    <th className="px-4 py-2 text-right font-medium">Resultado</th>
                    <th className="px-4 py-2 text-right font-medium">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {accountRows.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-md text-white" style={{ backgroundColor: row.color }}>
                            <Icon name={row.icon} className="h-3.5 w-3.5" />
                          </span>
                          <span className="font-medium">{row.name}</span>
                        </span>
                      </td>
                      <td className="tabular px-4 py-2 text-right text-success">{row.income ? formatBRL(row.income) : "-"}</td>
                      <td className="tabular px-4 py-2 text-right text-destructive">{row.expense ? formatBRL(row.expense) : "-"}</td>
                      <td className={cn("tabular px-4 py-2 text-right font-medium", row.result < 0 ? "text-destructive" : row.result > 0 ? "text-success" : "text-muted-foreground")}>{formatBRL(row.result)}</td>
                      <td className={cn("tabular px-4 py-2 text-right font-medium", row.balance < 0 && "text-destructive")}>{formatBRL(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {creditCardRows.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Cartões de crédito</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Cartão</th>
                      <th className="px-4 py-2 text-right font-medium">Compras</th>
                      <th className="px-4 py-2 text-right font-medium">Recebimentos</th>
                      <th className="px-4 py-2 text-right font-medium">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creditCardRows.map((row) => (
                      <tr key={row.id} className="border-b last:border-0">
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-md text-white" style={{ backgroundColor: row.color }}>
                              <Icon name={row.icon} className="h-3.5 w-3.5" />
                            </span>
                            <span className="font-medium">{row.name}</span>
                          </span>
                        </td>
                        <td className="tabular px-4 py-2 text-right text-destructive">{row.expense ? formatBRL(row.expense) : "-"}</td>
                        <td className="tabular px-4 py-2 text-right text-success">{row.income ? formatBRL(row.income) : "-"}</td>
                        <td className={cn("tabular px-4 py-2 text-right font-medium", row.balance < 0 && "text-destructive")}>{formatBRL(row.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Investimentos</CardTitle></CardHeader>
          <CardContent className="p-0">
            {investmentRows.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Ativo</th>
                      <th className="px-4 py-2 text-right font-medium">Investido</th>
                      <th className="px-4 py-2 text-right font-medium">Atual</th>
                      <th className="px-4 py-2 text-right font-medium">Rendimento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {investmentRows.map((row) => (
                      <tr key={row.id} className="border-b last:border-0">
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-2 font-medium">
                            <Landmark className="h-4 w-4 text-muted-foreground" /> {row.name}
                          </span>
                          <p className="text-xs text-muted-foreground">{row.type}</p>
                        </td>
                        <td className="tabular px-4 py-2 text-right">{formatBRL(row.invested)}</td>
                        <td className="tabular px-4 py-2 text-right font-medium">{formatBRL(row.current)}</td>
                        <td className={cn("tabular px-4 py-2 text-right font-medium", row.result < 0 ? "text-destructive" : row.result > 0 ? "text-success" : "text-muted-foreground")}>
                          {formatBRL(row.result)}
                          <span className="ml-1 text-xs text-muted-foreground">({percent(row.percent)})</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">Sem investimentos cadastrados.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Extrato filtrado</CardTitle>
          <Badge className="border-muted-foreground/30 bg-muted text-muted-foreground">
            {transactions.length} item(s)
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {transactions.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Data</th>
                    <th className="px-4 py-2 font-medium">Descrição</th>
                    <th className="px-4 py-2 font-medium">Conta</th>
                    <th className="px-4 py-2 font-medium">Categoria</th>
                    <th className="px-4 py-2 font-medium">Tags</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 100).map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="whitespace-nowrap px-4 py-2">{formatDate(row.date)}</td>
                      <td className="min-w-[220px] px-4 py-2">
                        <p className="font-medium">{row.description}</p>
                        <p className="text-xs text-muted-foreground">{txTypeLabel(row.type)}</p>
                      </td>
                      <td className="px-4 py-2">{row.accountLabel}</td>
                      <td className="px-4 py-2">{row.categoryLabel}</td>
                      <td className="px-4 py-2">
                        {row.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {row.tags.map((t) => (
                              <span
                                key={t.id}
                                className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                                style={{ color: t.color, backgroundColor: `${t.color}20` }}
                              >
                                {t.name}
                              </span>
                            ))}
                          </div>
                        ) : "-"}
                      </td>
                      <td className="px-4 py-2">{statusLabel(row.status)}</td>
                      <td className={cn("tabular px-4 py-2 text-right font-medium", row.type === "income" ? "text-success" : row.type === "expense" ? "text-destructive" : "")}>
                        {row.type === "income" ? "+" : row.type === "expense" ? "-" : ""}{formatBRL(row.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {transactions.length > 100 && (
                <p className="border-t px-4 py-3 text-xs text-muted-foreground print:hidden">
                  Mostrando 100 itens na tela. O CSV inclui todos os itens filtrados.
                </p>
              )}
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhum lançamento no período filtrado.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
