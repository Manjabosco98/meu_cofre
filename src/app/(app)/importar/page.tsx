import { makeQueryClient, ServerHydration } from "@/lib/query-utils";
import { createClient } from "@/lib/supabase/server";
import { ImporterView, type ImportBatchRow, type ImportAccount, type ImportCardOption } from "@/components/importer/importer-view";

export const dynamic = "force-dynamic";

export default async function ImportarPage() {
  const supabase = createClient();
  const qc = makeQueryClient();

  const queryData = await qc.fetchQuery({
    queryKey: ["imports"],
    queryFn: async () => {
      const [{ data: accountsData }, { data: batchesData }, { data: cardsData }] = await Promise.all([
        supabase
          .from("accounts")
          .select("id,name")
          .eq("archived", false)
          .neq("type", "credit_card")
          .order("name"),
        supabase
          .from("import_batches")
          .select("id,file_name,source,imported_count,duplicate_count,created_at")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("credit_cards")
          .select("id,account:accounts!credit_cards_account_id_fkey(name)")
          .order("created_at"),
      ]);
      return { accounts: accountsData ?? [], batches: batchesData ?? [], cards: cardsData ?? [] };
    },
  }) as {
    accounts: { id: string; name: string }[];
    batches: { id: string; file_name: string; source: string; imported_count: number; duplicate_count: number; created_at: string }[];
    cards: { id: string; account: { name: string } | null }[];
  };

  const cards: ImportCardOption[] = (queryData.cards ?? [])
    .filter((c) => c.account)
    .map((c) => ({ id: c.id, name: c.account!.name }));

  return (
    <ServerHydration qc={qc}>
      <ImporterView
        accounts={(queryData.accounts ?? []) as ImportAccount[]}
        cards={cards}
        batches={(queryData.batches ?? []) as ImportBatchRow[]}
      />
    </ServerHydration>
  );
}
