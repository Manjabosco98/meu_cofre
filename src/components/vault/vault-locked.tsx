"use client";

import { useState } from "react";
import { Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deriveKey, verify } from "@/lib/vault-crypto";
import type { VaultConfig } from "@/components/vault/types";

interface Props {
  config: VaultConfig;
  onUnlocked: (key: CryptoKey) => void;
}

export function VaultLocked({ config, onUnlocked }: Props) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const key = await deriveKey(password, config.salt, config.iterations);
      if (await verify(key, config.verifier)) {
        onUnlocked(key);
      } else {
        setError("Senha-mestra incorreta.");
        setBusy(false);
      }
    } catch {
      setError("Não foi possível desbloquear o cofre.");
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="p-6">
        <div className="mb-4 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold">Cofre bloqueado</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Informe sua senha-mestra para visualizar seus acessos.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="unlock">Senha-mestra</Label>
            <Input id="unlock" type="password" value={password} autoFocus autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full gap-2" disabled={busy || !password}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Desbloquear cofre
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
