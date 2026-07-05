"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldPlus, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StrengthBar } from "@/components/vault/strength-bar";
import {
  deriveKey, generateSalt, makeVerifier, passwordStrength, PBKDF2_ITERATIONS,
} from "@/lib/vault-crypto";
import { setupMasterPassword } from "@/app/(app)/configuracoes/cofre/actions";

export function MasterPasswordSetup({ onUnlocked }: { onUnlocked: (key: CryptoKey) => void }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = passwordStrength(password);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!strength.ok) {
      setError("A senha-mestra está fraca. Use ao menos 12 caracteres com letras, números e símbolos.");
      return;
    }
    if (password !== confirm) {
      setError("A confirmação não coincide.");
      return;
    }
    setBusy(true);
    try {
      const salt = generateSalt();
      const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
      const verifier = await makeVerifier(key);
      const res = await setupMasterPassword({ salt, iterations: PBKDF2_ITERATIONS, verifier });
      if (!res.ok) {
        setError(res.error);
        setBusy(false);
        return;
      }
      onUnlocked(key);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao configurar o cofre.");
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="p-6">
        <div className="mb-4 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldPlus className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold">Criar senha-mestra</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Esta senha protege o cofre e é diferente da senha de login. Ela nunca é enviada ao servidor.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="mp">Senha-mestra</Label>
            <Input id="mp" type="password" value={password} autoFocus autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)} />
            <StrengthBar strength={strength} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mpc">Confirmar senha-mestra</Label>
            <Input id="mpc" type="password" value={confirm} autoComplete="new-password"
              onChange={(e) => setConfirm(e.target.value)} />
          </div>

          <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Guarde sua senha-mestra com segurança. Sem ela, seus dados protegidos não poderão ser recuperados.</span>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full gap-2" disabled={busy || !password || !confirm}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar cofre
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
