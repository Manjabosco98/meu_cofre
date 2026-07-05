"use client";

import { useEffect, useState } from "react";
import { Loader2, Eye, EyeOff, Wand2, Star } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PasswordGenerator } from "@/components/vault/password-generator";
import { StrengthBar } from "@/components/vault/strength-bar";
import { passwordStrength } from "@/lib/vault-crypto";
import { cn } from "@/lib/utils";
import {
  TYPE_LABELS, STATUS_LABELS, type VaultItemForm, type VaultItemType, type VaultItemStatus,
} from "@/components/vault/types";
import type { ActionResult } from "@/lib/action-result";

export interface EditingItem extends VaultItemForm {
  id: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  editing: EditingItem | null;
  onSave: (form: VaultItemForm) => Promise<ActionResult>;
}

const EMPTY: VaultItemForm = {
  name: "", type: "platform", url: "", username: "", password: "", notes: "",
  token: "", apiKey: "", category: "", status: "active", has2fa: false,
  recoveryEmail: "", recoveryPhone: "", expiresAt: "", favorite: false, tags: "",
};

export function VaultItemDialog({ open, onClose, editing, onSave }: Props) {
  const [form, setForm] = useState<VaultItemForm>(EMPTY);
  const [showPass, setShowPass] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(editing ? { ...editing } : EMPTY);
    setShowPass(false);
    setGenOpen(false);
    setSaving(false);
    setError(null);
  }, [open, editing]);

  function set<K extends keyof VaultItemForm>(k: K, v: VaultItemForm[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError("Informe o nome do acesso.");
      return;
    }
    setSaving(true);
    const res = await onSave(form);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onClose();
  }

  const pwStrength = passwordStrength(form.password);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? "Editar acesso" : "Novo acesso"}
      className="sm:max-w-lg"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="v-name">Nome do acesso *</Label>
            <Input id="v-name" value={form.name} autoFocus onChange={(e) => set("name", e.target.value)} placeholder="Ex.: OpenAI" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v-type">Tipo</Label>
            <Select id="v-type" value={form.type} onChange={(e) => set("type", e.target.value as VaultItemType)}>
              {(Object.keys(TYPE_LABELS) as VaultItemType[]).map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="v-url">URL da plataforma</Label>
          <Input id="v-url" value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://..." inputMode="url" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="v-user">E-mail / usuário</Label>
          <Input id="v-user" value={form.username} onChange={(e) => set("username", e.target.value)} autoComplete="off" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="v-pass">Senha</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="v-pass"
                type={showPass ? "text" : "password"}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                autoComplete="new-password"
                className="pr-9"
              />
              <button type="button" onClick={() => setShowPass((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}>
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button type="button" variant="outline" className="gap-1.5" onClick={() => setGenOpen(true)}>
              <Wand2 className="h-4 w-4" /> Gerar
            </Button>
          </div>
          {form.password && <StrengthBar strength={pwStrength} />}
        </div>

        <details className="rounded-md border">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-muted-foreground">
            Segredos e recuperação (opcional)
          </summary>
          <div className="space-y-3 border-t p-3">
            <div className="space-y-1.5">
              <Label htmlFor="v-token">Token</Label>
              <Input id="v-token" value={form.token} onChange={(e) => set("token", e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-apikey">API key</Label>
              <Input id="v-apikey" value={form.apiKey} onChange={(e) => set("apiKey", e.target.value)} autoComplete="off" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="v-remail">E-mail de recuperação</Label>
                <Input id="v-remail" value={form.recoveryEmail} onChange={(e) => set("recoveryEmail", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="v-rphone">Telefone de recuperação</Label>
                <Input id="v-rphone" value={form.recoveryPhone} onChange={(e) => set("recoveryPhone", e.target.value)} />
              </div>
            </div>
          </div>
        </details>

        <div className="space-y-1.5">
          <Label htmlFor="v-notes">Observações seguras</Label>
          <Textarea id="v-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Cifradas antes de salvar" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="v-cat">Categoria</Label>
            <Input id="v-cat" value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="Ex.: Trabalho" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v-status">Status</Label>
            <Select id="v-status" value={form.status} onChange={(e) => set("status", e.target.value as VaultItemStatus)}>
              {(Object.keys(STATUS_LABELS) as VaultItemStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="v-tags">Tags</Label>
            <Input id="v-tags" value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="IA, API, Trabalho" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v-exp">Expiração da senha</Label>
            <Input id="v-exp" type="date" value={form.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => set("has2fa", !form.has2fa)}
            className={cn(
              "rounded-md border px-3 py-2 text-sm font-medium transition",
              form.has2fa ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent",
            )}
          >
            2FA {form.has2fa ? "ativado" : "desativado"}
          </button>
          <button
            type="button"
            onClick={() => set("favorite", !form.favorite)}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition",
              form.favorite ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400" : "text-muted-foreground hover:bg-accent",
            )}
          >
            <Star className={cn("h-4 w-4", form.favorite && "fill-current")} /> Favorito
          </button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving || !form.name.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? "Salvar" : "Adicionar"}
          </Button>
        </div>
      </form>

      <PasswordGenerator open={genOpen} onClose={() => setGenOpen(false)} onUse={(pw) => set("password", pw)} />
    </Dialog>
  );
}
