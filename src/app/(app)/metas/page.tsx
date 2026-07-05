import { makeQueryClient, ServerHydration } from "@/lib/query-utils";
import { fetchGoalsPageData } from "@/lib/query-fns";
import { GoalsView, type GoalRow, type Contribution } from "@/components/goals/goals-view";
import { addMonths } from "@/lib/card-invoice";

export const dynamic = "force-dynamic";

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}
function labelFromDate(dateStr: string): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "America/Sao_Paulo" })
    .format(new Date(dateStr + "T12:00:00"));
}
function addPeriods(dateStr: string, freq: string | null, count: number): string {
  if (freq === "weekly") {
    const d = new Date(dateStr + "T12:00:00");
    d.setDate(d.getDate() + count * 7);
    return d.toISOString().slice(0, 10);
  }
  if (freq === "fortnightly") {
    const d = new Date(dateStr + "T12:00:00");
    d.setDate(d.getDate() + count * 14);
    return d.toISOString().slice(0, 10);
  }
  return addMonths(dateStr, count);
}

export default async function MetasPage() {
  const qc = makeQueryClient();
  const data = await qc.fetchQuery({
    queryKey: ["goals", "page"],
    queryFn: fetchGoalsPageData,
  });

  const accounts = data.accounts as { id: string; name: string }[];

  const byGoal = new Map<string, Contribution[]>();
  for (const c of data.contributions as { id: string; goal_id: string; amount_cents: number; date: string; note: string | null; type: string }[]) {
    const list = byGoal.get(c.goal_id) ?? [];
    list.push({ id: c.id, amountCents: c.amount_cents, date: c.date, note: c.note, type: c.type });
    byGoal.set(c.goal_id, list);
  }

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const rows: GoalRow[] = (data.goals as {
    id: string; name: string; target_cents: number; deadline: string | null; color: string;
    status: string; recurring_contribution_cents: number | null; contribution_frequency: string | null;
    start_date: string | null; account_id: string | null;
  }[]).map((g) => {
    const list = byGoal.get(g.id) ?? [];
    const current = list.reduce((a, c) => a + c.amountCents, 0);
    const achieved = current >= g.target_cents;
    const remaining = Math.max(0, g.target_cents - current);

    const isPaused = g.status === "paused";
    const freq = g.contribution_frequency;
    const recurring = g.recurring_contribution_cents ?? 0;
    const startDate = g.start_date ?? todayStr;

    let monthsLeft: number | null = null;
    let projectedLabel: string | null = null;
    let estimatedDate: string | null = null;

    if (!achieved && !isPaused && recurring > 0 && remaining > 0) {
      const periodsNeeded = Math.ceil(remaining / recurring);
      estimatedDate = addPeriods(startDate, freq, periodsNeeded);
      const estDate = new Date(estimatedDate + "T12:00:00");
      monthsLeft = monthsBetween(now, estDate);
      if (monthsLeft < 0) monthsLeft = 0;
      projectedLabel = labelFromDate(estimatedDate);
    } else if (!achieved && !isPaused && list.filter((c) => c.amountCents > 0).length > 0) {
      const positives = list.filter((c) => c.amountCents > 0);
      const totalIn = positives.reduce((a, c) => a + c.amountCents, 0);
      const firstDate = new Date(positives[positives.length - 1].date);
      const elapsed = Math.max(1, monthsBetween(firstDate, now) + 1);
      const pace = totalIn / elapsed;
      if (pace > 0 && remaining > 0) {
        monthsLeft = Math.ceil(remaining / pace);
        estimatedDate = addMonths(todayStr, monthsLeft);
        projectedLabel = labelFromDate(estimatedDate);
      }
    }

    let monthlyForDeadline: number | null = null;
    if (!achieved && g.deadline && g.deadline > todayStr) {
      const periodsUntil = Math.max(1, monthsBetween(now, new Date(g.deadline + "T12:00:00")));
      monthlyForDeadline = Math.ceil(remaining / periodsUntil);
    }

    let displayStatus: "em_andamento" | "concluida" | "pausada" | "sem_previsao";
    if (achieved) displayStatus = "concluida";
    else if (isPaused) displayStatus = "pausada";
    else if (!recurring && !g.deadline) displayStatus = "sem_previsao";
    else displayStatus = "em_andamento";

    return {
      id: g.id,
      name: g.name,
      targetCents: g.target_cents,
      currentCents: current,
      deadline: g.deadline,
      color: g.color,
      archived: g.status === "archived",
      achieved,
      monthsLeft,
      projectedLabel,
      monthlyForDeadline,
      contributions: list,
      recurringContributionCents: recurring,
      contributionFrequency: freq,
      startDate,
      estimatedCompletionDate: estimatedDate,
      displayStatus,
      accountId: g.account_id,
    };
  });

  return (
    <ServerHydration qc={qc}>
      <GoalsView goals={rows} accounts={accounts} />
    </ServerHydration>
  );
}
