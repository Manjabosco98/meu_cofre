"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Copy, Check } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { generatePassword, passwordStrength, type GenOptions } from "@/lib/vault-crypto";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Se informado, mostra "Usar senha" que devolve a senha ao formulário. */
  onUse?: (password: string) => void;
}

const DEFAULTS: GenOptions = {
  length: 20,
  upper: true,
  lower: true,
  digits: true,
  symbols: true,
  avoidAmbiguous: true,
};

export function PasswordGenerator({ open, onClose, onUse }: Props) {
  const [opts, setOpts] = useState<GenOptions>(DEFAULTS);
  const [value, setValue] = useState("");
  const [copied, setCopied] = useState(false);

  const regen = useCallback((o: GenOptions) => setValue(generatePassword(o)), []);

  useEffect(() => {
    if (open) {
      setOpts(DEFAULTS);
      setValue(generatePassword(DEFAULTS));
      setCopied(false);
    }
  }, [open]);

  function update(patch: Partial<GenOptions>) {
    const next = { ...opts, ...patch };
    setOpts(next);
    regen(next);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard indisponível */
    }
  }

  const strength = passwordStrength(value);

  return (
    <Dialog open={open} onClose={onClose} title="Gerar senha segura">
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3">
          <code className="flex-1 break-all font-mono text-sm">{value}</code>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => regen(opts)} aria-label="Gerar outra">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={copy} aria-label="Copiar">
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Força:</span>
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 w-8 rounded-full",
                  i < strength.score
                    ? strength.score >= 3
                      ? "bg-success"
                      : strength.score === 2
                        ? "bg-amber-500"
                        : "bg-destructive"
                    : "bg-muted",
                )}
              />
            ))}
          </div>
          <span className="font-medium">{strength.label}</span>
        </div>

        <div className="space-y-2">
          <Label>Tamanho: {opts.length}</Label>
          <input
            type="range"
            min={8}
            max={64}
            value={opts.length}
            onChange={(e) => update({ length: Number(e.target.value) })}
            className="w-full accent-primary"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {([
            ["upper", "Maiúsculas (A-Z)"],
            ["lower", "Minúsculas (a-z)"],
            ["digits", "Números (0-9)"],
            ["symbols", "Símbolos (!@#)"],
            ["avoidAmbiguous", "Evitar ambíguos"],
          ] as [keyof GenOptions, string][]).map(([k, label]) => (
            <label key={k} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm">
              <input
                type="checkbox"
                checked={opts[k] as boolean}
                onChange={(e) => update({ [k]: e.target.checked } as Partial<GenOptions>)}
                className="h-4 w-4 accent-primary"
              />
              {label}
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Fechar</Button>
          {onUse && (
            <Button
              type="button"
              onClick={() => {
                onUse(value);
                onClose();
              }}
            >
              Usar senha
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
