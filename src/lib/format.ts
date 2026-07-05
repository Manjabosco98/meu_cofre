// Formatação pt-BR (moeda BRL, datas DD/MM/AAAA).

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Centavos -> "R$ 1.234,56". */
export function formatBRL(cents: number): string {
  return BRL.format(cents / 100);
}

/** Centavos -> "1.234,56" (sem símbolo, para inputs). */
export function formatAmount(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

const DATE = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

/** Data em DD/MM/AAAA. */
export function formatDate(date: Date | string): string {
  return DATE.format(typeof date === "string" ? new Date(date) : date);
}

const MONTH = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

/** "jul. 2026" para eixos de gráfico. */
export function formatMonth(date: Date | string): string {
  return MONTH.format(typeof date === "string" ? new Date(date) : date);
}
