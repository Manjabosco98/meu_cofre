import { makeQueryClient, ServerHydration } from "@/lib/query-utils";
import { createClient } from "@/lib/supabase/server";
import { ACCOUNT_TYPES, type AccountType } from "@/lib/account-meta";
import {
  PatrimonioView,
  type AssetItem,
  type LiabilityItem,
  type NetWorthPoint,
  type SnapshotItem,
} from "@/components/networth/patrimonio-view";

export const dynamic = "force-dynamic";

function monthLabel(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "America/Sao_Paulo" })
    .format(d)
    .replace(".", "");
}

const MONTHS = 12;

export default async function PatrimonioPage() {
  const supabase = createClient();
  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - (MONTHS - 1), 1);

  const qc = makeQueryClient();
  const d = await qc.fetchQuery({
    queryKey: ["netWorth", "page"],
    queryFn: async () => {
      const [
        { data: balances },
        { data: accounts },
        { data: investments },
        { data: trendTx },
        { data: snapshots },
      ] = await Promise.all([
        supabase.rpc("get_account_balances"),
        supabase.from("accounts").select("id,name,type,color,icon,archived"),
        supabase.from("investments").select("id,name,current_value_cents"),
        supabase
          .from("transactions")
          .select("date,type,amount_cents")
          .eq("status", "cleared")
          .in("type", ["income", "expense"])
          .gte("date", rangeStart.toISOString()),
        supabase
          .from("net_worth_snapshots")
          .select("id,date,assets_cents,liabilities_cents")
          .order("date", { ascending: true }),
      ]);
      return { balances: balances ?? [], accounts: accounts ?? [], investments: investments ?? [], trendTx: trendTx ?? [], snapshots: snapshots ?? [] };
    },
  }) as {
    balances: { account_id: string; balance_cents: number }[];
    accounts: { id: string; name: string; type: string; color: string; icon: string; archived: boolean }[];
    investments: { id: string; name: string; current_value_cents: number }[];
    trendTx: { date: string; type: string; amount_cents: number }[];
    snapshots: { id: string; date: string; assets_cents: number; liabilities_cents: number }[];
  };

  const balMap = new Map(d.balances.map((b) => [b.account_id, b.balance_cents]));

  const assetItems: AssetItem[] = [];
  const liabilityItems: LiabilityItem[] = [];
  for (const a of d.accounts) {
    if (a.archived) continue;
    const bal = balMap.get(a.id) ?? 0;
    if (ACCOUNT_TYPES[a.type as AccountType].isLiability) {
      const debt = Math.max(0, -bal);
      if (debt > 0) liabilityItems.push({ id: a.id, name: a.name, color: a.color, icon: a.icon, cents: debt });
    } else {
      assetItems.push({
        id: a.id, name: a.name, color: a.color, icon: a.icon, cents: bal,
        kind: ACCOUNT_TYPES[a.type as AccountType].label,
      });
    }
  }

  const investmentsTotal = d.investments.reduce((s, i) => s + i.current_value_cents, 0);
  for (const inv of d.investments) {
    assetItems.push({
      id: "inv-" + inv.id, name: inv.name, color: "#6366f1", icon: "trending-up",
      cents: inv.current_value_cents, kind: "Investimento",
    });
  }
  assetItems.sort((a, b) => b.cents - a.cents);
  liabilityItems.sort((a, b) => b.cents - a.cents);

  const accountAssets = assetItems.filter((i) => i.kind !== "Investimento").reduce((s, i) => s + i.cents, 0);
  const assetsCents = accountAssets + investmentsTotal;
  const liabilitiesCents = liabilityItems.reduce((s, i) => s + i.cents, 0);
  const netCents = assetsCents - liabilitiesCents;

  const buckets: { key: string; label: string; income: number; expense: number }[] = [];
  for (let i = 0; i < MONTHS; i++) {
    const dt = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + i, 1);
    buckets.push({ key: `${dt.getFullYear()}-${dt.getMonth()}`, label: monthLabel(dt), income: 0, expense: 0 });
  }
  const bucketMap = new Map(buckets.map((b) => [b.key, b]));
  for (const t of d.trendTx) {
    const dt = new Date(t.date);
    const b = bucketMap.get(`${dt.getFullYear()}-${dt.getMonth()}`);
    if (!b) continue;
    if (t.type === "income") b.income += t.amount_cents;
    else b.expense += t.amount_cents;
  }

  const values = buckets.map(() => 0);
  if (values.length) {
    values[values.length - 1] = netCents;
    for (let i = values.length - 2; i >= 0; i--) {
      const next = buckets[i + 1];
      values[i] = values[i + 1] - (next.income - next.expense);
    }
  }
  const bucketIndex = new Map(buckets.map((b, i) => [b.key, i]));
  for (const s of d.snapshots) {
    const dt = new Date(s.date + "T12:00:00");
    const idx = bucketIndex.get(`${dt.getFullYear()}-${dt.getMonth()}`);
    if (idx != null) values[idx] = s.assets_cents - s.liabilities_cents;
  }
  if (values.length) values[values.length - 1] = netCents;

  const series: NetWorthPoint[] = buckets.map((b, i) => ({ label: b.label, value: values[i] }));

  const snapshotItems: SnapshotItem[] = d.snapshots
    .map((s) => ({
      id: s.id, date: s.date, assetsCents: s.assets_cents, liabilitiesCents: s.liabilities_cents,
      netCents: s.assets_cents - s.liabilities_cents,
    }))
    .reverse();

  return (
    <ServerHydration qc={qc}>
      <PatrimonioView
        assetsCents={assetsCents}
        liabilitiesCents={liabilitiesCents}
        netCents={netCents}
        investmentsTotal={investmentsTotal}
        assetItems={assetItems}
        liabilityItems={liabilityItems}
        series={series}
        snapshots={snapshotItems}
      />
    </ServerHydration>
  );
}
