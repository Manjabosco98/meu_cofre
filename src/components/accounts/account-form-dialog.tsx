"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { MoneyInput } from "@/components/money-input";
import { ColorPicker } from "@/components/color-picker";
import {
  ACCOUNT_TYPE_OPTIONS, typeHasBankNumbers,
  type AccountType, type Titularidade,
} from "@/lib/account-meta";
import { OTHER_BANK, bankSigla, bankBySlug, bankName } from "@/lib/banks";
import { BankSelect } from "@/components/accounts/bank-select";
import type { AccountInput } from "@/lib/zod-schemas/account";
import { createAccount, updateAccount } from "@/app/(app)/contas/actions";
import { cn } from "@/lib/utils";

export interface AccountData {
  id: string;
  name: string;
  type: AccountType;
  institution: string | null;
  titularidade: Titularidade | null;
  agencia: string | null;
  numero_conta: string | null;
  initial_balance_cents: number;
  color: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  account: AccountData | null;
}

function initialBankState(institution: string | null): { select: string; custom: string } {
  if (!institution) return { select: "", custom: "" };
  if (bankBySlug(institution)) return { select: institution, custom: "" }; // slug conhecido
  return { select: OTHER_BANK, custom: institution }; // texto livre
}

export function AccountFormDialog({ open, onClose, account }: Props) {
  const router = useRouter();
  const isEdit = !!account;
  const initBank = initialBankState(account?.institution ?? null);

  const [type, setType] = useState<AccountType>(account?.type ?? "checking");
  const [bankSelect, setBankSelect] = useState(initBank.select);
  const [customBank, setCustomBank] = useState(initBank.custom);
  const [titularidade, setTitularidade] = useState<Titularidade>(account?.titularidade ?? "PF");
  const [agencia, setAgencia] = useState(account?.agencia ?? "");
  const [numeroConta, setNumeroConta] = useState(account?.numero_conta ?? "");
  const [apelido, setApelido] = useState(account?.name ?? "");
  const [apelidoTouched, setApelidoTouched] = useState(isEdit);
  const [balance, setBalance] = useState(account?.initial_balance_cents ?? 0);
  const [color, setColor] = useState(account?.color ?? "#6366f1");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const institution = bankSelect === OTHER_BANK ? customBank.trim() : bankSelect;
  const sigla = institution ? bankSigla(institution) : "";
  const showBankNumbers = typeHasBankNumbers(type);

  // Re-popula o formulário sempre que o modal abre, a partir da conta selecionada
  // (ou dos defaults, em "Nova conta"). Garante que cada abertura reflita a conta
  // clicada e reseta qualquer estado deixado por uma edição anterior.
  useEffect(() => {
    if (!open) return;
    const bank = initialBankState(account?.institution ?? null);
    setType(account?.type ?? "checking");
    setBankSelect(bank.select);
    setCustomBank(bank.custom);
    setTitularidade(account?.titularidade ?? "PF");
    setAgencia(account?.agencia ?? "");
    setNumeroConta(account?.numero_conta ?? "");
    setApelido(account?.name ?? "");
    setApelidoTouched(!!account); // em edição não auto-gera; em "nova" deixa auto-sugerir
    setBalance(account?.initial_balance_cents ?? 0);
    setColor(account?.color ?? "#6366f1");
    setError(null);
    setSaving(false);
  }, [open, account]);

  // Apelido auto = "SIGLA TITULARIDADE" enquanto o usuário não editar manualmente.
  useEffect(() => {
    if (apelidoTouched) return;
    setApelido(sigla ? `${sigla} ${titularidade}` : "");
  }, [sigla, titularidade, apelidoTouched]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!institution) {
      setError("Informe o banco/instituição");
      return;
    }
    const finalName = apelido.trim() || `${bankName(institution)} ${titularidade}`;

    setSaving(true);
    try {
      const payload: AccountInput = {
        name: finalName,
        type,
        institution,
        titularidade,
        agencia: showBankNumbers ? agencia.trim() || null : null,
        numero_conta: showBankNumbers ? numeroConta.trim() || null : null,
        initial_balance_cents: balance,
        color,
        icon: "wallet",
        archived: false,
      };
      const res = account ? await updateAccount(account.id, payload) : await createAccount(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
      onClose();
    } catch (err) {
      console.error("Falha ao salvar conta:", err);
      setError(err instanceof Error ? err.message : "Erro inesperado ao salvar a conta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={account ? "Editar conta" : "Nova conta"} className="sm:max-w-lg">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="acc-bank">Banco / Instituição</Label>
            <BankSelect id="acc-bank" value={bankSelect} onChange={setBankSelect} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acc-type">Tipo</Label>
            <Select id="acc-type" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
              {ACCOUNT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
        </div>

        {bankSelect === OTHER_BANK && (
          <div className="space-y-1.5">
            <Label htmlFor="acc-custom-bank">Nome da instituição</Label>
            <Input id="acc-custom-bank" value={customBank} onChange={(e) => setCustomBank(e.target.value)} placeholder="Ex.: Banco XPTO" autoFocus />
          </div>
        )}

        {/* Titularidade */}
        <div className="space-y-1.5">
          <Label>Titularidade</Label>
          <div className="grid grid-cols-2 gap-2">
            {([["PF", "Pessoa física (PF)"], ["PJ", "Pessoa jurídica (PJ)"]] as const).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setTitularidade(v)}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm font-medium transition",
                  titularidade === v ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Agência e conta — só para corrente/poupança */}
        {showBankNumbers && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="acc-ag">Agência</Label>
              <Input id="acc-ag" value={agencia} onChange={(e) => setAgencia(e.target.value)} placeholder="0001" inputMode="numeric" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-num">Número da conta</Label>
              <Input id="acc-num" value={numeroConta} onChange={(e) => setNumeroConta(e.target.value)} placeholder="12345-6" />
            </div>
          </div>
        )}

        {/* Apelido */}
        <div className="space-y-1.5">
          <Label htmlFor="acc-apelido">Apelido</Label>
          <Input
            id="acc-apelido"
            value={apelido}
            onChange={(e) => { setApelido(e.target.value); setApelidoTouched(true); }}
            placeholder="Ex.: NU PJ"
          />
          <p className="text-xs text-muted-foreground">Sugerido automaticamente (sigla + titularidade). Você pode editar.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="acc-balance">Saldo inicial</Label>
            <MoneyInput id="acc-balance" value={balance} onChange={setBalance} />
          </div>
          <div className="space-y-1.5">
            <Label>Cor</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {account ? "Salvar" : "Criar conta"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
