import { makeQueryClient, ServerHydration } from "@/lib/query-utils";
import { fetchInvestmentsPageData } from "@/lib/query-fns";
import { InvestmentsView, type InvestmentRow, type InvestmentEntry } from "@/components/investments/investments-view";

export const dynamic = "force-dynamic";

export default async function InvestimentosPage() {
  const qc = makeQueryClient();
  const data = await qc.fetchQuery({
    queryKey: ["investments", "page"],
    queryFn: fetchInvestmentsPageData,
  });

  const byInv = new Map<string, InvestmentEntry[]>();
  for (const e of data.entries as { id: string; investment_id: string; amount_cents: number; type: string; date: string; note: string | null }[]) {
    const list = byInv.get(e.investment_id) ?? [];
    list.push({
      id: e.id,
      amountCents: e.amount_cents,
      type: e.type as "deposit" | "withdraw",
      date: e.date,
      note: e.note,
    });
    byInv.set(e.investment_id, list);
  }

  const rows: InvestmentRow[] = (data.investments as { id: string; name: string; type: string; current_value_cents: number; updated_at: string }[]).map((inv) => {
    const list = byInv.get(inv.id) ?? [];
    const invested = list.reduce(
      (acc, e) => acc + (e.type === "withdraw" ? -e.amountCents : e.amountCents),
      0,
    );
    const current = inv.current_value_cents;
    const result = current - invested;
    return {
      id: inv.id,
      name: inv.name,
      type: inv.type,
      currentCents: current,
      investedCents: invested,
      resultCents: result,
      updatedAt: inv.updated_at,
      entries: list,
    };
  });

  return (
    <ServerHydration qc={qc}>
      <InvestmentsView investments={rows} />
    </ServerHydration>
  );
}
