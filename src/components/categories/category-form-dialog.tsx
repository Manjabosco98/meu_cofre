"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColorPicker } from "@/components/color-picker";
import { IconPicker } from "@/components/icon-picker";
import { Icon } from "@/components/lucide-icon";
import type { CategoryKind, ParentOption } from "@/components/categories/categories-view";
import type { CategoryInput } from "@/lib/zod-schemas/category";
import { createCategory, updateCategory } from "@/app/(app)/categorias/actions";
import { cn } from "@/lib/utils";

export interface CategoryData {
  id: string;
  name: string;
  kind: CategoryKind;
  parent_id: string | null;
  color: string;
  icon: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  category: CategoryData | null;
  parents: ParentOption[];
  /** Pré-seleção ao criar (ex.: botão "+ subcategoria" dentro de uma categoria). */
  defaultKind?: CategoryKind;
  defaultParentId?: string | null;
}

const FORM_ID = "category-form";

export function CategoryFormDialog({
  open,
  onClose,
  category,
  parents,
  defaultKind,
  defaultParentId,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(category?.name ?? "");
  const [kind, setKind] = useState<CategoryKind>(category?.kind ?? defaultKind ?? "expense");
  const [parentId, setParentId] = useState<string>(category?.parent_id ?? defaultParentId ?? "");
  const [color, setColor] = useState(category?.color ?? "#64748b");
  const [icon, setIcon] = useState(category?.icon ?? "tag");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reinicializa ao abrir: "novo" começa limpo (com defaults), "editar" com a categoria.
  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? "");
    setKind(category?.kind ?? defaultKind ?? "expense");
    setParentId(category?.parent_id ?? defaultParentId ?? "");
    setColor(category?.color ?? "#64748b");
    setIcon(category?.icon ?? "tag");
    setError(null);
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category]);

  const parentName = parentId ? parents.find((p) => p.id === parentId)?.name : null;
  // Trava o tipo ao editar (mudar afetaria subcategorias/lançamentos já vinculados)
  // e ao criar/editar subcategoria (tipo sempre herdado da mãe).
  const kindLocked = !!category || !!parentId;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const payload: CategoryInput = {
      name,
      kind,
      parent_id: parentId || null,
      color,
      icon,
    };
    const res = category ? await updateCategory(category.id, payload) : await createCategory(payload);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={category ? "Editar categoria" : "Nova categoria"}
      description="Categorias organizam receitas e despesas; subcategorias detalham."
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={FORM_ID} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {category ? "Salvar" : "Criar"}
          </Button>
        </div>
      }
    >
      <form id={FORM_ID} onSubmit={onSubmit} className="space-y-5">
        {/* Tipo (income/expense) */}
        <div className="space-y-2">
          <Label>Tipo</Label>
          {kindLocked ? (
            <div
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium",
                kind === "income"
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-destructive/30 bg-destructive/10 text-destructive",
              )}
            >
              <Lock className="h-3 w-3 opacity-70" />
              {kind === "income" ? "Receita" : "Despesa"}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {(["expense", "income"] as CategoryKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={kind === k}
                  onClick={() => setKind(k)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    kind === k
                      ? k === "income"
                        ? "border-success bg-success/10 text-success"
                        : "border-destructive bg-destructive/10 text-destructive"
                      : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  {k === "income" ? "Receita" : "Despesa"}
                </button>
              ))}
            </div>
          )}
          {kindLocked && (
            <p className="text-xs text-muted-foreground/80">
              {parentId
                ? "Subcategoria segue o tipo da categoria-mãe."
                : "O tipo não pode ser alterado após a criação (afeta subcategorias e lançamentos vinculados)."}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="cat-name">Nome</Label>
          <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>

        <div className="space-y-2">
          <Label>Categoria-mãe</Label>
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            {parentName ?? "Nenhuma (categoria principal)"}
          </div>
          <p className="text-xs text-muted-foreground/80">
            {parentName
              ? "Definida ao criar a subcategoria; para mudar, exclua e recrie."
              : "Categorias principais não têm mãe. Use o \"+\" dentro dela para criar uma subcategoria."}
          </p>
        </div>

        <div className="space-y-3">
          {/* Preview ao vivo */}
          <div className="flex items-center gap-3 rounded-md border bg-muted/20 px-3 py-2.5">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
              style={{ backgroundColor: color }}
            >
              <Icon name={icon} className="h-5 w-5" />
            </div>
            <span className="truncate text-sm font-medium">{name.trim() || "Nome da categoria"}</span>
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <div className="space-y-2">
            <Label>Ícone</Label>
            <IconPicker value={icon} onChange={setIcon} />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>
    </Dialog>
  );
}
