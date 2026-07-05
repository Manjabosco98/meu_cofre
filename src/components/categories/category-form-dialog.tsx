"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ColorPicker } from "@/components/color-picker";
import { IconPicker } from "@/components/icon-picker";
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

  const parentOptions = parents.filter((p) => p.kind === kind && p.id !== category?.id);

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
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {/* Tipo (income/expense) */}
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <div className="grid grid-cols-2 gap-2">
            {(["expense", "income"] as CategoryKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setKind(k);
                  setParentId("");
                }}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm font-medium transition",
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
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cat-name">Nome</Label>
          <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cat-parent">Categoria-mãe (opcional)</Label>
          <Select id="cat-parent" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">Nenhuma (categoria principal)</option>
            {parentOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">
            Escolha uma categoria-mãe para criar uma subcategoria.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Cor</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <div className="space-y-1.5">
            <Label>Ícone</Label>
            <IconPicker value={icon} onChange={setIcon} />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {category ? "Salvar" : "Criar"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
