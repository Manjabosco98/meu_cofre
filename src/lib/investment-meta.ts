// Tipos de investimento (chave guardada em investments.type). Rótulo/cor por tipo.

interface InvestmentTypeMeta {
  label: string;
  color: string;
}

export const INVESTMENT_TYPES: Record<string, InvestmentTypeMeta> = {
  renda_fixa: { label: "Renda fixa", color: "#0ea5e9" },
  tesouro: { label: "Tesouro Direto", color: "#22c55e" },
  cdb: { label: "CDB / LCI / LCA", color: "#14b8a6" },
  acoes: { label: "Ações", color: "#f97316" },
  fii: { label: "Fundos imobiliários", color: "#a855f7" },
  fundo: { label: "Fundos", color: "#6366f1" },
  cripto: { label: "Criptomoedas", color: "#eab308" },
  previdencia: { label: "Previdência", color: "#ec4899" },
  outro: { label: "Outro", color: "#64748b" },
};

export const INVESTMENT_TYPE_KEYS = Object.keys(INVESTMENT_TYPES);

export const INVESTMENT_TYPE_OPTIONS = INVESTMENT_TYPE_KEYS.map((value) => ({
  value,
  label: INVESTMENT_TYPES[value].label,
}));

export function investmentTypeMeta(type: string): InvestmentTypeMeta {
  return INVESTMENT_TYPES[type] ?? { label: type || "Outro", color: "#64748b" };
}
