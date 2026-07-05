import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { ACCOUNT_TYPES, type AccountType } from "@/lib/account-meta";

// Regra de patrimônio (única fonte da verdade — usada pela página e pelo snapshot):
//  - Contas arquivadas são ignoradas.
//  - Cartão de crédito é passivo: sua dívida = saldo negativo (max(0, -saldo)).
//  - Demais contas entram como ativo pelo saldo (mesmo se negativo, ex.: cheque especial).
//  - Investimentos (tabela investments) somam nos ativos pelo valor atual manual.
export interface NetWorthNow {
  assetsCents: number;
  liabilitiesCents: number;
  netCents: number;
}

export async function computeNetWorthNow(
  supabase: SupabaseClient<Database>,
): Promise<NetWorthNow> {
  const [{ data: balances }, { data: accounts }, { data: investments }] = await Promise.all([
    supabase.rpc("get_account_balances"),
    supabase.from("accounts").select("id,type,archived"),
    supabase.from("investments").select("current_value_cents"),
  ]);

  const balMap = new Map((balances ?? []).map((b) => [b.account_id, b.balance_cents]));
  let assets = 0;
  let liabilities = 0;
  for (const a of accounts ?? []) {
    if (a.archived) continue;
    const bal = balMap.get(a.id) ?? 0;
    if (ACCOUNT_TYPES[a.type as AccountType].isLiability) {
      liabilities += Math.max(0, -bal);
    } else {
      assets += bal;
    }
  }
  assets += (investments ?? []).reduce((s, i) => s + i.current_value_cents, 0);

  return { assetsCents: assets, liabilitiesCents: liabilities, netCents: assets - liabilities };
}
