"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColorPicker } from "@/components/color-picker";
import type { TagInput } from "@/lib/zod-schemas/category";
import { createTag, updateTag } from "@/app/(app)/categorias/actions";

export interface TagData {
  id: string;
  name: string;
  color: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  tag: TagData | null;
}

export function TagFormDialog({ open, onClose, tag }: Props) {
  const router = useRouter();
  const [name, setName] = useState(tag?.name ?? "");
  const [color, setColor] = useState(tag?.color ?? "#0ea5e9");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reinicializa ao abrir: "nova tag" limpa, "editar" com os dados da tag.
  useEffect(() => {
    if (!open) return;
    setName(tag?.name ?? "");
    setColor(tag?.color ?? "#0ea5e9");
    setError(null);
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tag]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const payload: TagInput = { name, color };
    const res = tag ? await updateTag(tag.id, payload) : await createTag(payload);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title={tag ? "Editar tag" : "Nova tag"}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="tag-name">Nome</Label>
          <Input id="tag-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label>Cor</Label>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {tag ? "Salvar" : "Criar"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
