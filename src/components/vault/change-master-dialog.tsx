"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StrengthBar } from "@/components/vault/strength-bar";
import {
  deriveKey, verify, generateSalt, makeVerifier, encryptField, decryptField,
  passwordStrength, PBKDF2_ITERATIONS,
} from "@/lib/vault-crypto";
import { changeMasterPassword } from "@/app/(app)/configuracoes/cofre/actions";
import type { VaultConfig, VaultItem } from "@/components/vault/types";

interface Props {
  open: boolean;
  onClose: () => void;
  config: VaultConfig;
  items: VaultItem[];
  onChanged: (key: CryptoKey) => void;
}

export function ChangeMasterDialog({ open, onClose, config, items, onChanged }: Props) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCurrent(""); setNext(""); setConfirm(""); setBusy(false); setError(null);
  }, [open]);

  const strength = passwordStrength(next);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!strength.ok) {
      setError("A nova senha-mestra está fraca.");
      return;
    }
    if (next !== confirm) {
      setError("A confirmação não coincide.");
      return;
    }
    setBusy(true);
    try {
      const oldKey = await deriveKey(current, config.salt, config.iterations);
      if (!(await verify(oldKey, config.verifier))) {
        setError("Senha-mestra atual incorreta.");
        setBusy(false);
        return;
      }
      const salt = generateSalt();
      const newKey = await deriveKey(next, salt, PBKDF2_ITERATIONS);
      const verifier = await makeVerifier(newKey);

      // Re-cifra os segredos de todos os itens com a nova chave.
      const reencrypted = await Promise.all(
        items.map(async (it) => {
          const dec = async (v: string | null) => (v ? await decryptField(oldKey, v) : "");
          const enc = async (v: string) => (v ? await encryptField(newKey, v) : null);
          return {
            id: it.id,
            encrypted_password: await enc(await dec(it.encrypted_password)),
            encrypted_notes: await enc(await dec(it.encrypted_notes)),
            encrypted_token: await enc(await dec(it.encrypted_token)),
            encrypted_api_key: await enc(await dec(it.encrypted_api_key)),
          };
        }),
      );

      const res = await changeMasterPassword({
        salt, iterations: PBKDF2_ITERATIONS, verifier, items: reencrypted,
      });
      if (!res.ok) {
        setError(res.error);
        setBusy(false);
        return;
      }
      onChanged(newKey);
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao alterar a senha-mestra.");
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Alterar senha-mestra"
      description="Os dados do cofre serão recriptografados com a nova senha.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="cm-cur">Senha-mestra atual</Label>
          <Input id="cm-cur" type="password" value={current} autoComplete="current-password"
            onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cm-new">Nova senha-mestra</Label>
          <Input id="cm-new" type="password" value={next} autoComplete="new-password"
            onChange={(e) => setNext(e.target.value)} />
          {next && <StrengthBar strength={strength} />}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cm-conf">Confirmar nova senha</Label>
          <Input id="cm-conf" type="password" value={confirm} autoComplete="new-password"
            onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={busy || !current || !next || !confirm}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Alterar senha-mestra
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
