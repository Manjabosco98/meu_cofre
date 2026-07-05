// Helpers de formatação para gráficos (valores chegam em CENTAVOS).

/** Eixo Y compacto: 12.345 -> "12,3 mil" / 1.234.567 -> "1,2 mi". */
export function formatAxisBRL(cents: number): string {
  const v = cents / 100;
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000) return `${(v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return v.toLocaleString("pt-BR");
}

/** Cores usadas nos gráficos (legíveis em claro/escuro). */
export const CHART_COLORS = {
  income: "#22c55e",
  expense: "#ef4444",
  networth: "#6366f1",
  axis: "#94a3b8",
  grid: "#94a3b833",
};
