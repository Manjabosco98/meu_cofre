import Link from "next/link";
import { makeQueryClient, ServerHydration } from "@/lib/query-utils";
import { fetchDashboardData } from "@/lib/query-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/lucide-icon";
import { formatBRL, formatDate } from "@/lib/format";
import {
  Wallet, TrendingUp, TrendingDown, Scale, CalendarClock, AlertTriangle,
} from "lucide-react";
import { IncomeExpenseChart, NetWorthChart, CategoryDonut } from "@/components/dashboard/lazy-charts";
import type { MonthPoint } from "@/components/dashboard/income-expense-chart";
import type { NetWorthPoint } from "@/components/dashboard/networth-chart";
import type { CategorySlice } from "@/components/dashboard/category-donut";
import { PeriodToggle } from "@/components/dashboard/period-toggle";

export const dynamic = "force-dynamic";

function monthLabel(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "America/Sao_Paulo" })
    .format(d)
    .replace(".", "");
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const mesesParam = typeof searchParams.meses === "string" ? parseInt(searchParams.meses, 10) : 6;
  const meses = mesesParam === 12 ? 12 : 6;

  const qc = makeQueryClient();
  const data = await qc.fetchQuery({
    queryKey: ["dashboard", { meses }],
    queryFn: () => fetchDashboardData(meses),
  });

  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - (meses - 1), 1);
  const todayStr = now.toISOString().slice(0, 10);

  const consolidated = data.consolidated;

  const buckets: { key: string; label: string; income: number; expense: number }[] = [];
  for (let i = 0; i < meses; i++) {
    const d = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + i, 1);
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: monthLabel(d), income: 0, expense: 0 });
  }
  const bucketMap = new Map(buckets.map((b) => [b.key, b]));
  for (const t of data.trendTx ?? []) {
    const d = new Date(t.date);
    const b = bucketMap.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (!b) continue;
    if (t.type === "income") b.income += t.amount_cents;
    else b.expense += t.amount_cents;
  }

  const trendData: MonthPoint[] = buckets.map((b) => ({ label: b.label, income: b.income, expense: b.expense }));

  const current = buckets[buckets.length - 1];
  const incomeMonth = current?.income ?? 0;
  const expenseMonth = current?.expense ?? 0;
  const resultMonth = incomeMonth - expenseMonth;

  const nwData: NetWorthPoint[] = buckets.map((b) => ({ label: b.label, value: 0 }));
  if (nwData.length) {
    nwData[nwData.length - 1].value = consolidated;
    for (let i = nwData.length - 2; i >= 0; i--) {
      const next = buckets[i + 1];
      nwData[i].value = nwData[i + 1].value - (next.income - next.expense);
    }
  }

  const catMap = new Map((data.categories ?? []).map((c: { id: string; parent_id?: string | null; name?: string; color?: string }) => [c.id, c]));
  const rootColor = new Map<string, string>();
  const rootName = new Map<string, string>();
  const sliceTotals = new Map<string, number>();
  for (const e of data.monthExpenses ?? []) {
    let rootId = "none";
    let name = "Sem categoria";
    let color = "#94a3b8";
    if (e.category_id && catMap.has(e.category_id)) {
      const c = catMap.get(e.category_id)! as { parent_id: string | null; name: string; color: string };
      const root = c.parent_id && catMap.has(c.parent_id) ? catMap.get(c.parent_id)! as { name: string; color: string } : c;
      rootId = (root as unknown as { id: string }).id ?? rootId;
      name = root.name;
      color = root.color;
    }
    rootName.set(rootId, name);
    rootColor.set(rootId, color);
    sliceTotals.set(rootId, (sliceTotals.get(rootId) ?? 0) + e.amount_cents);
  }
  let slices: CategorySlice[] = [...sliceTotals.entries()]
    .map(([id, value]) => ({ name: rootName.get(id)!, value, color: rootColor.get(id)! }))
    .sort((a, b) => b.value - a.value);
  if (slices.length > 8) {
    const rest = slices.slice(7).reduce((acc, s) => acc + s.value, 0);
    slices = [...slices.slice(0, 7), { name: "Outros", value: rest, color: "#cbd5e1" }];
  }

  const cards = [
    { label: "Saldo consolidado", value: formatBRL(consolidated), icon: Wallet, hint: `${data.accountsCount ?? 0} conta(s) ativa(s)`, tone: "" },
    { label: "Receitas do mês", value: formatBRL(incomeMonth), icon: TrendingUp, hint: "realizadas", tone: "text-success" },
    { label: "Despesas do mês", value: formatBRL(expenseMonth), icon: TrendingDown, hint: "realizadas", tone: "text-destructive" },
    { label: "Resultado do mês", value: formatBRL(resultMonth), icon: Scale, hint: resultMonth >= 0 ? "sobra" : "déficit", tone: resultMonth >= 0 ? "text-success" : "text-destructive" },
  ];

  return (
    <ServerHydration qc={qc}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-muted-foreground">Visão geral das suas finanças.</p>
          </div>
          <PeriodToggle value={meses} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => {
            const Icon2 = c.icon;
            return (
              <Card key={c.label}>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                  <Icon2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`tabular text-2xl font-bold ${c.tone}`}>{c.value}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Receitas × Despesas</CardTitle>
            </CardHeader>
            <CardContent>
              <IncomeExpenseChart data={trendData} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evolução do patrimônio</CardTitle>
            </CardHeader>
            <CardContent>
              <NetWorthChart data={nwData} />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Despesas por categoria · mês</CardTitle>
            </CardHeader>
            <CardContent>
              {slices.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Nenhuma despesa realizada neste mês.
                </p>
              ) : (
                <CategoryDonut data={slices} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>A pagar / receber</CardTitle>
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {!data.upcoming || data.upcoming.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum lançamento previsto. <Link href="/lancamentos" className="text-primary hover:underline">Adicionar</Link>
                </p>
              ) : (
                <ul className="divide-y">
                  {data.upcoming.map((u: { id: string; date: string; type: string; amount_cents: number; description: string; account: { name: string; color: string; icon: string } | null }) => {
                    const acc = u.account;
                    const overdue = u.date.slice(0, 10) < todayStr;
                    const isIncome = u.type === "income";
                    return (
                      <li key={u.id} className="flex items-center gap-3 py-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: acc?.color ?? "#64748b" }}>
                          <Icon name={acc?.icon} className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{u.description}</p>
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            {formatDate(u.date)}
                            {overdue && (
                              <Badge className="border-destructive/40 bg-destructive/10 text-destructive">
                                <AlertTriangle className="h-3 w-3" /> em atraso
                              </Badge>
                            )}
                          </p>
                        </div>
                        <span className={`tabular shrink-0 text-sm font-semibold ${isIncome ? "text-success" : "text-destructive"}`}>
                          {isIncome ? "+" : "−"}{formatBRL(u.amount_cents)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ServerHydration>
  );
}
