"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Loader2, Save, ShieldCheck, UserRound } from "lucide-react";
import { updateProfileSettings } from "@/app/(app)/configuracoes/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SettingsTabs } from "@/components/settings/settings-tabs";

export interface ProfileSettingsData {
  name: string;
  avatar_url: string | null;
  currency: "BRL";
  timezone: "America/Sao_Paulo";
  theme: "system" | "light" | "dark";
}

interface Props {
  profile: ProfileSettingsData;
  email: string;
}

export function SettingsView({ profile, email }: Props) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [form, setForm] = useState<{
    name: string;
    avatar_url: string;
    currency: "BRL";
    timezone: "America/Sao_Paulo";
    theme: "system" | "light" | "dark";
  }>({
    name: profile.name,
    avatar_url: profile.avatar_url ?? "",
    currency: profile.currency,
    timezone: profile.timezone,
    theme: profile.theme,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await updateProfileSettings(form);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setTheme(form.theme);
    setMessage("Configurações salvas.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="mt-1 text-muted-foreground">Perfil, moeda, fuso horário e tema da aplicação.</p>
      </div>

      <SettingsTabs />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader><CardTitle>Perfil e preferências</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" value={email} disabled />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="avatar">Avatar URL</Label>
                <Input
                  id="avatar"
                  value={form.avatar_url}
                  onChange={(e) => setForm((prev) => ({ ...prev, avatar_url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="currency">Moeda</Label>
                  <Select
                    id="currency"
                    value={form.currency}
                    onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value as "BRL" }))}
                  >
                    <option value="BRL">BRL - Real</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Fuso horário</Label>
                  <Select
                    id="timezone"
                    value={form.timezone}
                    onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value as "America/Sao_Paulo" }))}
                  >
                    <option value="America/Sao_Paulo">America/Sao_Paulo</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="theme">Tema</Label>
                  <Select
                    id="theme"
                    value={form.theme}
                    onChange={(e) => setForm((prev) => ({ ...prev, theme: e.target.value as "system" | "light" | "dark" }))}
                  >
                    <option value="system">Sistema</option>
                    <option value="light">Claro</option>
                    <option value="dark">Escuro</option>
                  </Select>
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
              {message && <p className="text-sm text-success">{message}</p>}

              <Button type="submit" disabled={busy} className="gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar configurações
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="flex gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">Conta pessoal</p>
                <p className="mt-1 text-sm text-muted-foreground">Cadastro público segue desativado; este app está configurado para uso próprio.</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-success/10 text-success">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">Dados protegidos por RLS</p>
                <p className="mt-1 text-sm text-muted-foreground">As configurações são salvas em `profiles` e respeitam a sessão autenticada.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
