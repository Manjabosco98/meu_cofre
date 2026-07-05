// Utilitários monetários. Regra do projeto: dinheiro é SEMPRE inteiro em centavos.
// Nunca fazer aritmética financeira com float.

/** Converte reais (número ou string "1.234,56"/"1234.56") para centavos. */
export function toCents(value: number | string): number {
  if (typeof value === "number") return Math.round(value * 100);
  const normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace(/R\$/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "") // separador de milhar
    .replace(",", ".");
  const num = Number(normalized);
  return Number.isNaN(num) ? 0 : Math.round(num * 100);
}

/** Centavos -> reais (só para exibição/gráfico). */
export function toReais(cents: number): number {
  return cents / 100;
}

export function sumCents(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}
