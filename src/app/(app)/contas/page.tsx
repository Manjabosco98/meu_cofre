import { makeQueryClient, ServerHydration } from "@/lib/query-utils";
import { fetchAccountsPageData } from "@/lib/query-fns";
import { AccountsView, type AccountWithBalance } from "@/components/accounts/accounts-view";
import type { AccountType } from "@/lib/account-meta";

export const dynamic = "force-dynamic";

export default async function ContasPage() {
  const qc = makeQueryClient();
  const data = await qc.fetchQuery({
    queryKey: ["accounts", "page"],
    queryFn: fetchAccountsPageData,
  });

  const balMap = new Map((data.balances as { account_id: string; balance_cents: number }[]).map((b) => [b.account_id, b.balance_cents]));

  const goalCurrentMap = new Map<string, number>();
  for (const c of data.contributions as { goal_id: string; amount_cents: number }[]) {
    goalCurrentMap.set(c.goal_id, (goalCurrentMap.get(c.goal_id) ?? 0) + c.amount_cents);
  }

  const reservedMap = new Map<string, number>();
  for (const g of data.goals as { id: string; account_id: string | null }[]) {
    if (!g.account_id) continue;
    const current = goalCurrentMap.get(g.id) ?? 0;
    reservedMap.set(g.account_id, (reservedMap.get(g.account_id) ?? 0) + current);
  }

  const accounts = data.accounts as {
    id: string; name: string; type: string; institution: string | null;
    titularidade: string | null; agencia: string | null; numero_conta: string | null;
    initial_balance_cents: number; color: string; icon: string; archived: boolean;
  }[];

  const rows: AccountWithBalance[] = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type as AccountType,
    institution: a.institution,
    titularidade: (a.titularidade as "PF" | "PJ" | null) ?? null,
    agencia: a.agencia,
    numero_conta: a.numero_conta,
    initial_balance_cents: a.initial_balance_cents,
    color: a.color,
    icon: a.icon,
    archived: a.archived,
    balance_cents: balMap.get(a.id) ?? a.initial_balance_cents,
    reservedInGoals: reservedMap.get(a.id) ?? 0,
  }));

  return (
    <ServerHydration qc={qc}>
      <AccountsView accounts={rows} />
    </ServerHydration>
  );
}
