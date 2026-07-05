import type { Enums } from "@/lib/database.types";

export type AccountType = Enums<"account_type">;

interface AccountTypeMeta {
  label: string;
  icon: string;
  /** Cartão de crédito é passivo; os demais são ativos. */
  isLiability: boolean;
}

export const ACCOUNT_TYPES: Record<AccountType, AccountTypeMeta> = {
  checking: { label: "Conta corrente", icon: "landmark", isLiability: false },
  savings: { label: "Poupança", icon: "piggy-bank", isLiability: false },
  cash: { label: "Dinheiro", icon: "banknote", isLiability: false },
  credit_card: { label: "Cartão de crédito", icon: "credit-card", isLiability: true },
  investment: { label: "Investimentos", icon: "trending-up", isLiability: false },
};

// Cartão de crédito é gerido na aba "Cartões" (não é opção de conta comum).
export const ACCOUNT_TYPE_OPTIONS = (Object.keys(ACCOUNT_TYPES) as AccountType[])
  .filter((value) => value !== "credit_card")
  .map((value) => ({ value, label: ACCOUNT_TYPES[value].label }));

// Agência e número da conta só fazem sentido em conta corrente/poupança.
export function typeHasBankNumbers(type: AccountType): boolean {
  return type === "checking" || type === "savings";
}

export type Titularidade = "PF" | "PJ";

// Catálogo de bancos, logos e helpers (slug/nome/sigla) migraram para `@/lib/banks`.
