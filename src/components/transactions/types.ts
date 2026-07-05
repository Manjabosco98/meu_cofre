import type { AccountType } from "@/lib/account-meta";

export interface AccountOption {
  id: string;
  name: string;
  color: string;
  icon: string;
  type: AccountType;
}

export interface CategoryOption {
  id: string;
  name: string;
  kind: "income" | "expense";
  parent_id: string | null;
  color: string;
  icon: string;
}

export interface TagOption {
  id: string;
  name: string;
  color: string;
}

export type TxKind = "income" | "expense" | "transfer";
export type TxStatus = "pending" | "cleared";

/** Item de exibição na lista (transferência já vem colapsada em 1 item). */
export interface TxItem {
  id: string;
  kind: TxKind;
  amount_cents: number; // sempre positivo (valor de exibição — realizado se cleared, previsto se pending)
  date: string;
  description: string;
  notes: string | null;
  status: TxStatus;
  // receita/despesa
  account: AccountOption | null;
  category: { id: string; name: string; color: string; icon: string } | null;
  tags: TagOption[];
  // transferência
  fromAccount: AccountOption | null;
  toAccount: AccountOption | null;
  transferGroupId: string | null;
  // anexos
  attachmentCount: number;
  // previsto x realizado
  valorPrevisto: number;
  valorRealizado: number | null;
  // recorrência
  recurringRuleId: string | null;
}

/** Dados para edição no formulário. */
export interface TxEditData {
  id: string;
  type: TxKind;
  amount_cents: number;
  date: string; // yyyy-mm-dd
  description: string;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  tag_ids: string[];
  notes: string | null;
  status: TxStatus;
  transferGroupId: string | null;
  // previsto x realizado
  valorRealizado: number | null;
}
