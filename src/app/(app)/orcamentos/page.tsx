import { makeQueryClient, ServerHydration } from "@/lib/query-utils";
import { createClient } from "@/lib/supabase/server";
import { BudgetsView, type BudgetRow } from "@/components/budgets/budgets-view";
import type { ComparisonPoint } from "@/components/budgets/budget-comparison-chart";
import type { CategoryOption } from "@/components/transactions/types";

export const dynamic = "force-dynamic";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default async function OrcamentosPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const supabase = createClient();

  const mes = typeof searchParams.mes === "string" ? searchParams.mes : "";
  const now = new Date();
  const [yy, mm] = mes.match(/^\d{4}-\d{2}$/)
    ? mes.split("-").map(Number)
    : [now.getFullYear(), now.getMonth() + 1];

  const monthFirst = `${yy}-${pad(mm)}-01`;
  const monthStart = new Date(yy, mm - 1, 1).toISOString();
  const monthEnd = new Date(yy, mm, 0, 23, 59, 59).toISOString();

  const rangeStartDate = new Date(yy, mm - 1 - 5, 1);
  const rangeStartFirst = `${rangeStartDate.getFullYear()}-${pad(rangeStartDate.getMonth() + 1)}-01`;
  const rangeStartISO = rangeStartDate.toISOString();

  const qc = makeQueryClient();
  const queryData = await qc.fetchQuery({
    queryKey: ["budgets", { month: monthFirst }],
    queryFn: async () => {
      const [{ data: budgets }, { data: cats }, { data: monthExpenses }, { data: rangeBudgets }, { data: rangeExpenses }] =
        await Promise.all([
          supabase.from("budgets").select("id,category_id,limit_cents").eq("month", monthFirst),
          supabase.from("categories").select("id,name,kind,parent_id,color,icon").order("name"),
          supabase.from("transactions").select("amount_cents,category_id").eq("status", "cleared").eq("type", "expense").gte("date", monthStart).lte("date", monthEnd),
          supabase.from("budgets").select("month,limit_cents").gte("month", rangeStartFirst).lte("month", monthFirst),
          supabase.from("transactions").select("date,amount_cents").eq("status", "cleared").eq("type", "expense").gte("date", rangeStartISO).lte("date", monthEnd),
        ]);
      return { budgets: budgets ?? [], categories: cats ?? [], monthExpenses: monthExpenses ?? [], rangeBudgets: rangeBudgets ?? [], rangeExpenses: rangeExpenses ?? [] };
    },
  }) as {
    budgets: { id: string; category_id: string; limit_cents: number }[];
    categories: { id: string; name: string; kind: string; parent_id: string | null; color: string; icon: string }[];
    monthExpenses: { amount_cents: number; category_id: string | null }[];
    rangeBudgets: { month: string; limit_cents: number }[];
    rangeExpenses: { date: string; amount_cents: number }[];
  };

  const catMap = new Map(queryData.categories.map((c) => [c.id, c]));
  const budgetByCat = new Map(queryData.budgets.map((b) => [b.category_id, b]));

  const spentByCat = new Map<string, number>();
  for (const e of queryData.monthExpenses) {
    if (!e.category_id) continue;
    let target: string | null = null;
    if (budgetByCat.has(e.category_id)) target = e.category_id;
    else {
      const c = catMap.get(e.category_id);
      if (c?.parent_id && budgetByCat.has(c.parent_id)) target = c.parent_id;
    }
    if (target) spentByCat.set(target, (spentByCat.get(target) ?? 0) + e.amount_cents);
  }

  const rows: BudgetRow[] = queryData.budgets
    .map((b) => {
      const c = catMap.get(b.category_id);
      return {
        id: b.id,
        categoryId: b.category_id,
        name: c?.name ?? "Categoria",
        color: c?.color ?? "#64748b",
        icon: c?.icon ?? "tag",
        limitCents: b.limit_cents,
        spentCents: spentByCat.get(b.category_id) ?? 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const totalBudget = rows.reduce((a, r) => a + r.limitCents, 0);
  const totalSpent = rows.reduce((a, r) => a + r.spentCents, 0);

  const availableCategories: CategoryOption[] = queryData.categories
    .filter((c) => c.kind === "expense" && !budgetByCat.has(c.id))
    .map((c) => ({ id: c.id, name: c.name, kind: "expense" as const, parent_id: c.parent_id, color: c.color, icon: c.icon }));

  const monthsList: { key: string; label: string; budget: number; spent: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(yy, mm - 1 - 5 + i, 1);
    monthsList.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(d).replace(".", ""),
      budget: 0,
      spent: 0,
    });
  }
  const monthsMap = new Map(monthsList.map((m) => [m.key, m]));
  for (const b of queryData.rangeBudgets) {
    const d = new Date(b.month + "T12:00:00");
    const bucket = monthsMap.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (bucket) bucket.budget += b.limit_cents;
  }
  for (const e of queryData.rangeExpenses) {
    const d = new Date(e.date);
    const bucket = monthsMap.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (bucket) bucket.spent += e.amount_cents;
  }
  const comparison: ComparisonPoint[] = monthsList.map((m) => ({ label: m.label, budget: m.budget, spent: m.spent }));

  return (
    <ServerHydration qc={qc}>
      <BudgetsView
        monthFirst={monthFirst}
        rows={rows}
        totalBudget={totalBudget}
        totalSpent={totalSpent}
        comparison={comparison}
        availableCategories={availableCategories}
      />
    </ServerHydration>
  );
}
