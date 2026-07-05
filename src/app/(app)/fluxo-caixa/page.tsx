import { makeQueryClient, ServerHydration } from "@/lib/query-utils";
import { createClient } from "@/lib/supabase/server";
import { CashflowView, type FlowRow } from "@/components/cashflow/cashflow-view";
import {
  getRange, iteratePeriods, periodStart, periodEnd, periodKey, periodLabel, ymdLocal,
  type Granularity,
} from "@/lib/cashflow";

export const dynamic = "force-dynamic";

export default async function FluxoCaixaPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const supabase = createClient();
  const g = (typeof searchParams.g === "string" ? searchParams.g : "week") as Granularity;
  const gran: Granularity = g === "day" || g === "month" ? g : "week";

  const today = new Date();
  const todayStr = ymdLocal(today);
  const { start, end } = getRange(gran, today);
  const periods = iteratePeriods(start, end, gran);
  const lastEnd = periodEnd(periods[periods.length - 1], gran);

  const firstPeriodStart = periods[0];
  const startISO = new Date(Date.UTC(firstPeriodStart.getFullYear(), firstPeriodStart.getMonth(), firstPeriodStart.getDate())).toISOString();
  const endISO = new Date(Date.UTC(lastEnd.getFullYear(), lastEnd.getMonth(), lastEnd.getDate(), 23, 59, 59)).toISOString();

  const qc = makeQueryClient();
  const queryData = await qc.fetchQuery({
    queryKey: ["cashflow", gran],
    queryFn: async () => {
      const [{ data: balances }, { data: txs }] = await Promise.all([
        supabase.rpc("get_account_balances"),
        supabase
          .from("transactions")
          .select("type,amount_cents,date,status")
          .in("type", ["income", "expense"])
          .gte("date", startISO)
          .lte("date", endISO),
      ]);
      return { balances: balances ?? [], transactions: txs ?? [] };
    },
  }) as {
    balances: { account_id: string; balance_cents: number }[];
    transactions: { type: string; amount_cents: number; date: string; status: string }[];
  };

  const currentConsolidated = (queryData.balances ?? []).reduce((a, b) => a + b.balance_cents, 0);

  let clearedToToday = 0;
  const buckets = new Map<string, { entradas: number; saidas: number }>();
  for (const p of periods) buckets.set(periodKey(p, gran), { entradas: 0, saidas: 0 });

  for (const t of queryData.transactions ?? []) {
    const dateDay = t.date.slice(0, 10);
    const isCleared = t.status === "cleared";
    const include = (isCleared && dateDay <= todayStr) || t.status === "pending";
    if (!include) continue;
    if (isCleared && dateDay <= todayStr) {
      clearedToToday += t.type === "income" ? t.amount_cents : -t.amount_cents;
    }
    const key = periodKey(periodStart(new Date(dateDay + "T12:00:00"), gran), gran);
    const b = buckets.get(key);
    if (!b) continue;
    if (t.type === "income") b.entradas += t.amount_cents;
    else b.saidas += t.amount_cents;
  }

  const opening = currentConsolidated - clearedToToday;

  let running = opening;
  const rows: FlowRow[] = periods.map((p) => {
    const key = periodKey(p, gran);
    const b = buckets.get(key)!;
    const resultado = b.entradas - b.saidas;
    running += resultado;
    const startStr = ymdLocal(p);
    const endStr = ymdLocal(periodEnd(p, gran));
    return {
      key,
      label: periodLabel(p, gran),
      entradas: b.entradas,
      saidas: b.saidas,
      resultado,
      saldo: running,
      isFuture: startStr > todayStr,
      isCurrent: startStr <= todayStr && endStr >= todayStr,
    };
  });

  const projected = rows.filter((r) => r.isFuture || r.isCurrent);
  let minProjected: { value: number; label: string } | null = null;
  for (const r of projected) {
    if (!minProjected || r.saldo < minProjected.value) minProjected = { value: r.saldo, label: r.label };
  }
  const hasNegative = projected.some((r) => r.saldo < 0);

  return (
    <ServerHydration qc={qc}>
      <CashflowView
        granularity={gran}
        rows={rows}
        saldoAtual={currentConsolidated}
        minProjected={minProjected}
        hasNegative={hasNegative}
      />
    </ServerHydration>
  );
}
