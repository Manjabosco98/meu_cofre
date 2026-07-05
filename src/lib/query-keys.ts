/**
 * Chaves de query do React Query para invalidação seletiva após mutations.
 * Padrão: cada tela tem uma chave; sub-chaves parametrizam filtros.
 *
 * Uso em Server Actions (após mutation):
 *   import { queryKeys } from "@/lib/query-keys";
 *   revalidatePath("/dashboard"); // server-side
 *
 * Uso em Client Components (após mutation via useMutation):
 *   import { useQueryClient } from "@tanstack/react-query";
 *   import { queryKeys } from "@/lib/query-keys";
 *   const qc = useQueryClient();
 *   qc.invalidateQueries({ queryKey: queryKeys.dashboard });
 */
export const queryKeys = {
  dashboard: ["dashboard"] as const,
  dashboardWith: (meses: number) => ["dashboard", { meses }] as const,

  accounts: ["accounts"] as const,
  accountsPage: ["accounts", "page"] as const,

  transactions: ["transactions"] as const,
  transactionsList: (filters: Record<string, unknown>) =>
    ["transactions", "list", filters] as const,

  categories: ["categories"] as const,
  tags: ["tags"] as const,
  categoriesPage: ["categories", "page"] as const,

  creditCards: ["creditCards"] as const,
  invoices: ["invoices"] as const,

  budgets: ["budgets"] as const,
  budgetsPage: (month: string) => ["budgets", { month }] as const,

  goals: ["goals"] as const,
  goalsPage: ["goals", "page"] as const,

  investments: ["investments"] as const,
  investmentsPage: ["investments", "page"] as const,

  cashflow: ["cashflow"] as const,

  netWorth: ["netWorth"] as const,
  netWorthPage: ["netWorth", "page"] as const,

  reports: ["reports"] as const,

  notifications: ["notifications"] as const,

  imports: ["imports"] as const,

  agenda: ["agenda"] as const,
} as const;

/**
 * Grupos de queries afetadas por cada tipo de mutation.
 * Usar com qc.invalidateQueries({ queryKey: queryGroups.lancamento }).
 * Cada mutation invalida apenas as telas que dependem dos dados alterados.
 */
export const queryGroups = {
  /** Qualquer mutation em lançamentos */
  lancamento: ["transactions"],
  /** Qualquer mutation em contas */
  conta: ["accounts", "accountsPage"],
  /** Qualquer mutation em categorias ou tags */
  categoria: ["categories", "tags", "categoriesPage"],
  /** Qualquer mutation em cartões ou faturas */
  cartao: ["creditCards", "invoices"],
  /** Qualquer mutation em orçamentos */
  orcamento: ["budgets"],
  /** Qualquer mutation em metas */
  meta: ["goals", "goalsPage"],
  /** Qualquer mutation em investimentos */
  investimento: ["investments", "investmentsPage"],
  /** Qualquer mutation em notificações */
  notificacao: ["notifications"],
} as const;
