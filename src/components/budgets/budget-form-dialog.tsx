"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { MoneyInput } from "@/components/money-input";
import type { CategoryOption } from "@/components/transactions/types";
import type { BudgetInput } from "@/lib/zod-schemas/budget";
import { createBudget, updateBudget } from "@/app/(app)/orcamentos/actions";

export interface BudgetEdit {
  id: string;
  categoryName: string;
  limitCents: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  month: string; // yyyy-mm-01
  editing: BudgetEdit | null;
  availableCategories: CategoryOption[]; // para criar (expense, ainda sem orçamento)
}

export function BudgetFormDialog({ open, onClose, month, editing, availableCategories }: Props) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(availableCategories[0]?.id ?? "");
  const [limit, setLimit] = useState(editing?.limitCents ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reinicializa ao abrir: "novo" com defaults, "editar" com o limite do orçamento.
  useEffect(() => {
    if (!open) return;
    setCategoryId(availableCategories[0]?.id ?? "");
    setLimit(editing?.limitCents ?? 0);
    setError(null);
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const parents = availableCategories.filter((c) => !c.parent_id);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    let res;
    if (editing) {
      res = await updateBudget(editing.id, limit);
    } else {
      const payload: BudgetInput = { category_id: categoryId, month, limit_cents: limit };
      res = await createBudget(payload);
    }
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title={editing ? "Editar orçamento" : "Novo orçamento"}>
      <form onSubmit={onSubmit} className="space-y-4">
        {editing ? (
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">{editing.categoryName}</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="b-cat">Categoria</Label>
            <Select id="b-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {availableCategories.length === 0 && <option value="">Nenhuma categoria disponível</option>}
              {parents.map((p) => (
                <optgroup key={p.id} label={p.name}>
                  <option value={p.id}>{p.name}</option>
                  {availableCategories.filter((c) => c.parent_id === p.id).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="b-limit">Limite mensal</Label>
          <MoneyInput id="b-limit" value={limit} onChange={setLimit} />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving || limit <= 0 || (!editing && !categoryId)}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? "Salvar" : "Criar"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
