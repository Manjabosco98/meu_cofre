"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, CornerDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/lucide-icon";
import { CategoryFormDialog, type CategoryData } from "@/components/categories/category-form-dialog";
import { TagFormDialog, type TagData } from "@/components/categories/tag-form-dialog";
import { deleteCategory, deleteTag } from "@/app/(app)/categorias/actions";
import { cn } from "@/lib/utils";

export type CategoryKind = "income" | "expense";
export interface ParentOption {
  id: string;
  name: string;
  kind: CategoryKind;
}

export interface CategoryRow {
  id: string;
  name: string;
  kind: CategoryKind;
  parent_id: string | null;
  color: string;
  icon: string;
  is_default: boolean;
}

interface Props {
  categories: CategoryRow[];
  tags: TagData[];
}

export function CategoriesView({ categories, tags }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<CategoryKind>("expense");

  const [catForm, setCatForm] = useState<{
    open: boolean;
    editing: CategoryData | null;
    defaultKind: CategoryKind;
    defaultParentId: string | null;
  }>({ open: false, editing: null, defaultKind: "expense", defaultParentId: null });

  const [tagForm, setTagForm] = useState<{ open: boolean; editing: TagData | null }>({
    open: false,
    editing: null,
  });

  const [catToDelete, setCatToDelete] = useState<CategoryRow | null>(null);
  const [tagToDelete, setTagToDelete] = useState<TagData | null>(null);
  const [busy, setBusy] = useState(false);

  const parents = categories.filter((c) => !c.parent_id && c.kind === tab);
  const childrenOf = (id: string) => categories.filter((c) => c.parent_id === id);
  const parentOptions: ParentOption[] = categories
    .filter((c) => !c.parent_id)
    .map((c) => ({ id: c.id, name: c.name, kind: c.kind }));

  function openCreateCategory() {
    setCatForm({ open: true, editing: null, defaultKind: tab, defaultParentId: null });
  }
  function openCreateSub(parent: CategoryRow) {
    setCatForm({ open: true, editing: null, defaultKind: parent.kind, defaultParentId: parent.id });
  }
  function openEditCategory(c: CategoryRow) {
    setCatForm({
      open: true,
      editing: { id: c.id, name: c.name, kind: c.kind, parent_id: c.parent_id, color: c.color, icon: c.icon },
      defaultKind: c.kind,
      defaultParentId: c.parent_id,
    });
  }

  async function confirmDeleteCategory() {
    if (!catToDelete) return;
    setBusy(true);
    await deleteCategory(catToDelete.id);
    setBusy(false);
    setCatToDelete(null);
    router.refresh();
  }
  async function confirmDeleteTag() {
    if (!tagToDelete) return;
    setBusy(true);
    await deleteTag(tagToDelete.id);
    setBusy(false);
    setTagToDelete(null);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categorias e tags</h1>
          <p className="mt-1 text-muted-foreground">Organize seus lançamentos por categoria e tags.</p>
        </div>
        <Button onClick={openCreateCategory} className="gap-2">
          <Plus className="h-4 w-4" /> Nova categoria
        </Button>
      </div>

      {/* Tabs receita/despesa */}
      <div className="inline-flex rounded-lg border bg-muted/40 p-1">
        {(["expense", "income"] as CategoryKind[]).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition",
              tab === k ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {k === "expense" ? "Despesas" : "Receitas"}
          </button>
        ))}
      </div>

      {/* Lista de categorias */}
      {parents.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma categoria de {tab === "expense" ? "despesa" : "receita"} ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {parents.map((p) => {
            const children = childrenOf(p.id);
            return (
              <Card key={p.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-white"
                      style={{ backgroundColor: p.color }}
                    >
                      <Icon name={p.icon} className="h-5 w-5" />
                    </div>
                    <p className="flex-1 font-medium">{p.name}</p>
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="icon" aria-label="Nova subcategoria" onClick={() => openCreateSub(p)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => openEditCategory(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Excluir"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setCatToDelete(p)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {children.length > 0 && (
                    <ul className="mt-3 space-y-1 border-t pt-3">
                      {children.map((c) => (
                        <li key={c.id} className="flex items-center gap-2 pl-1 text-sm">
                          <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground" />
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: c.color }}
                          />
                          <span className="flex-1">{c.name}</span>
                          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Editar" onClick={() => openEditCategory(c)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            aria-label="Excluir"
                            onClick={() => setCatToDelete(c)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Tags */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tags</h2>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setTagForm({ open: true, editing: null })}>
            <Plus className="h-4 w-4" /> Nova tag
          </Button>
        </div>
        {tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma tag ainda. Tags servem para cortes transversais (ex.: viagem, trabalho).
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <Badge
                key={t.id}
                className="group cursor-default gap-1.5 py-1 pl-2.5 pr-1"
                style={{ borderColor: t.color, color: t.color }}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                {t.name}
                <button
                  className="ml-1 rounded p-0.5 hover:bg-accent"
                  aria-label="Editar tag"
                  onClick={() => setTagForm({ open: true, editing: t })}
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  className="rounded p-0.5 text-destructive hover:bg-accent"
                  aria-label="Excluir tag"
                  onClick={() => setTagToDelete(t)}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CategoryFormDialog
        open={catForm.open}
        onClose={() => setCatForm((s) => ({ ...s, open: false }))}
        category={catForm.editing}
        parents={parentOptions}
        defaultKind={catForm.defaultKind}
        defaultParentId={catForm.defaultParentId}
        key={`${catForm.editing?.id ?? "new"}-${catForm.defaultParentId ?? ""}-${catForm.open}`}
      />
      <TagFormDialog
        open={tagForm.open}
        onClose={() => setTagForm((s) => ({ ...s, open: false }))}
        tag={tagForm.editing}
        key={`tag-${tagForm.editing?.id ?? "new"}-${tagForm.open}`}
      />

      <Dialog
        open={!!catToDelete}
        onClose={() => setCatToDelete(null)}
        title="Excluir categoria"
        description="Lançamentos ligados a ela ficam sem categoria. Subcategorias viram principais."
      >
        <p className="mb-4 text-sm">
          Excluir <strong>{catToDelete?.name}</strong>?
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setCatToDelete(null)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirmDeleteCategory} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Excluir
          </Button>
        </div>
      </Dialog>

      <Dialog open={!!tagToDelete} onClose={() => setTagToDelete(null)} title="Excluir tag">
        <p className="mb-4 text-sm">
          Excluir a tag <strong>{tagToDelete?.name}</strong>?
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setTagToDelete(null)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirmDeleteTag} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Excluir
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
