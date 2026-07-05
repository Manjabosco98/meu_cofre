"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Archive, ArchiveRestore, Trash2, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { BankLogo } from "@/components/bank-logo";
import { AccountFormDialog, type AccountData } from "@/components/accounts/account-form-dialog";
import { ACCOUNT_TYPES, type AccountType, type Titularidade } from "@/lib/account-meta";
import { bankName } from "@/lib/banks";
import { formatBRL } from "@/lib/format";
import { setAccountArchived, deleteAccount } from "@/app/(app)/contas/actions";

export interface AccountWithBalance {
  id: string;
  name: string;
  type: AccountType;
  institution: string | null;
  titularidade: Titularidade | null;
  agencia: string | null;
  numero_conta: string | null;
  initial_balance_cents: number;
  color: string;
  icon: string;
  archived: boolean;
  balance_cents: number;
  reservedInGoals: number;
}

export function AccountsView({ accounts }: { accounts: AccountWithBalance[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AccountData | null>(null);
  const [toDelete, setToDelete] = useState<AccountWithBalance | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);
  const consolidated = active.reduce((acc, a) => acc + a.balance_cents - a.reservedInGoals, 0);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(a: AccountWithBalance) {
    setEditing({
      id: a.id,
      name: a.name,
      type: a.type,
      institution: a.institution,
      titularidade: a.titularidade,
      agencia: a.agencia,
      numero_conta: a.numero_conta,
      initial_balance_cents: a.initial_balance_cents,
      color: a.color,
    });
    setFormOpen(true);
  }

  async function toggleArchive(a: AccountWithBalance) {
    setBusyId(a.id);
    await setAccountArchived(a.id, !a.archived);
    setBusyId(null);
    router.refresh();
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setBusyId(toDelete.id);
    await deleteAccount(toDelete.id);
    setBusyId(null);
    setToDelete(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contas</h1>
          <p className="mt-1 text-muted-foreground">
            Saldo consolidado:{" "}
            <span className="tabular font-semibold text-foreground">{formatBRL(consolidated)}</span>
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Nova conta
        </Button>
      </div>

      {active.length === 0 && archived.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Wallet className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium">Nenhuma conta ainda</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Crie sua primeira carteira para começar a registrar lançamentos.
            </p>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Nova conta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              busy={busyId === a.id}
              onEdit={() => openEdit(a)}
              onArchive={() => toggleArchive(a)}
              onDelete={() => setToDelete(a)}
            />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Arquivadas
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {archived.map((a) => (
              <AccountCard
                key={a.id}
                account={a}
                busy={busyId === a.id}
                onEdit={() => openEdit(a)}
                onArchive={() => toggleArchive(a)}
                onDelete={() => setToDelete(a)}
              />
            ))}
          </div>
        </div>
      )}

      <AccountFormDialog open={formOpen} onClose={() => setFormOpen(false)} account={editing} />

      <Dialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Excluir conta"
        description="Esta ação não pode ser desfeita e remove também os lançamentos da conta."
      >
        <p className="mb-4 text-sm">
          Tem certeza que deseja excluir <strong>{toDelete?.name}</strong>?
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setToDelete(null)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirmDelete} disabled={busyId === toDelete?.id}>
            {busyId === toDelete?.id && <Loader2 className="h-4 w-4 animate-spin" />}
            Excluir
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function AccountCard({
  account,
  busy,
  onEdit,
  onArchive,
  onDelete,
}: {
  account: AccountWithBalance;
  busy: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const meta = ACCOUNT_TYPES[account.type];
  const available = account.balance_cents - account.reservedInGoals;
  const negative = available < 0;

  return (
    <Card className={account.archived ? "opacity-60" : undefined}>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <BankLogo
              bank={account.institution}
              color={account.color}
              fallbackIcon={account.icon}
              className="h-10 w-10"
            />
            <div className="min-w-0">
              <p className="truncate font-medium leading-tight">{account.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {bankName(account.institution) || meta.label}
                {account.titularidade ? ` · ${account.titularidade}` : ""}
                {` · ${meta.label}`}
              </p>
              {(account.agencia || account.numero_conta) && (
                <p className="truncate text-xs text-muted-foreground">
                  {account.agencia ? `Ag. ${account.agencia}` : ""}
                  {account.agencia && account.numero_conta ? " · " : ""}
                  {account.numero_conta ? `Conta ${account.numero_conta}` : ""}
                </p>
              )}
            </div>
          </div>
          {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Saldo</p>
          <p className={`tabular text-xl font-bold ${negative ? "text-destructive" : ""}`}>
            {formatBRL(available)}
          </p>
        </div>

        {account.reservedInGoals > 0 && (
          <div className="flex justify-between rounded-md bg-muted/40 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Reservado em metas</span>
            <span className="tabular font-medium text-foreground">{formatBRL(account.reservedInGoals)}</span>
          </div>
        )}

        <div className="flex gap-1 border-t pt-2">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={onArchive}>
            {account.archived ? (
              <>
                <ArchiveRestore className="h-3.5 w-3.5" /> Restaurar
              </>
            ) : (
              <>
                <Archive className="h-3.5 w-3.5" /> Arquivar
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto text-destructive hover:text-destructive"
            onClick={onDelete}
            aria-label="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
