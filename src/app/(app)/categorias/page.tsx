import { makeQueryClient, ServerHydration } from "@/lib/query-utils";
import { fetchCategoriesPageData } from "@/lib/query-fns";
import { CategoriesView, type CategoryRow } from "@/components/categories/categories-view";
import type { TagData } from "@/components/categories/tag-form-dialog";

export const dynamic = "force-dynamic";

export default async function CategoriasPage() {
  const qc = makeQueryClient();
  const data = await qc.fetchQuery({
    queryKey: ["categories", "page"],
    queryFn: fetchCategoriesPageData,
  });

  const catRows: CategoryRow[] = (data.categories as { id: string; name: string; kind: string; parent_id: string | null; color: string; icon: string; is_default: boolean }[]).map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind as CategoryRow["kind"],
    parent_id: c.parent_id,
    color: c.color,
    icon: c.icon,
    is_default: c.is_default,
  }));

  const tagRows: TagData[] = (data.tags as { id: string; name: string; color: string }[]).map((t) => ({ id: t.id, name: t.name, color: t.color }));

  return (
    <ServerHydration qc={qc}>
      <CategoriesView categories={catRows} tags={tagRows} />
    </ServerHydration>
  );
}
