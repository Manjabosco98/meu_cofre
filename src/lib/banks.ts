// Catálogo de bancos brasileiros com logo local (auto-hospedada em /public/banks).
// O SLUG é o identificador estável salvo no banco (accounts.institution), NÃO o nome
// exibido — renomear o rótulo não quebra o vínculo com a logo.

export interface Bank {
  slug: string;
  nome: string;
  sigla: string; // usada no apelido automático das contas
  logo: string; // caminho do SVG estático
  cor: string; // cor da marca (hex) — usada no fallback/realce
}

/** Valor especial do seletor para banco não listado (institution guarda texto livre). */
export const OTHER_BANK = "__outro__";

export const BANKS: Bank[] = [
  { slug: "nubank", nome: "Nubank", sigla: "NU", logo: "/banks/nubank.svg", cor: "#820AD1" },
  { slug: "itau", nome: "Itaú", sigla: "ITAÚ", logo: "/banks/itau.svg", cor: "#EC7000" },
  { slug: "bradesco", nome: "Bradesco", sigla: "BRAD", logo: "/banks/bradesco.svg", cor: "#CC092F" },
  { slug: "bb", nome: "Banco do Brasil", sigla: "BB", logo: "/banks/bb.svg", cor: "#0038A8" },
  { slug: "caixa", nome: "Caixa Econômica", sigla: "CEF", logo: "/banks/caixa.svg", cor: "#0070AF" },
  { slug: "santander", nome: "Santander", sigla: "SANT", logo: "/banks/santander.svg", cor: "#EC0000" },
  { slug: "inter", nome: "Banco Inter", sigla: "INTER", logo: "/banks/inter.svg", cor: "#FF7A00" },
  { slug: "c6", nome: "C6 Bank", sigla: "C6", logo: "/banks/c6.svg", cor: "#242424" },
  { slug: "btg", nome: "BTG Pactual", sigla: "BTG", logo: "/banks/btg.svg", cor: "#001E62" },
  { slug: "sicoob", nome: "Sicoob", sigla: "SICOOB", logo: "/banks/sicoob.svg", cor: "#003641" },
  { slug: "sicredi", nome: "Sicredi", sigla: "SICREDI", logo: "/banks/sicredi.svg", cor: "#3FA110" },
  { slug: "picpay", nome: "PicPay", sigla: "PICPAY", logo: "/banks/picpay.svg", cor: "#11C76F" },
  { slug: "mercadopago", nome: "Mercado Pago", sigla: "MP", logo: "/banks/mercadopago.svg", cor: "#009EE3" },
  { slug: "original", nome: "Banco Original", sigla: "ORIG", logo: "/banks/original.svg", cor: "#00A868" },
  { slug: "safra", nome: "Banco Safra", sigla: "SAFRA", logo: "/banks/safra.svg", cor: "#002F5F" },
  { slug: "xp", nome: "XP Investimentos", sigla: "XP", logo: "/banks/xp.svg", cor: "#0F0F0F" },
  { slug: "neon", nome: "Neon", sigla: "NEON", logo: "/banks/neon.svg", cor: "#0F92FF" },
  { slug: "banrisul", nome: "Banrisul", sigla: "BANRI", logo: "/banks/banrisul.svg", cor: "#0069B4" },
  { slug: "pan", nome: "Banco PAN", sigla: "PAN", logo: "/banks/pan.svg", cor: "#0AB2F9" },
];

const BY_SLUG = new Map(BANKS.map((b) => [b.slug, b]));
const BY_NOME = new Map(BANKS.map((b) => [b.nome.toLowerCase(), b]));
const BY_SIGLA = new Map(BANKS.map((b) => [b.sigla.toLowerCase(), b]));

/** Banco pelo slug (ou undefined para texto livre / "Outro"). */
export function bankBySlug(slug: string | null | undefined): Bank | undefined {
  return slug ? BY_SLUG.get(slug) : undefined;
}

/** Rótulo humano de um valor de institution: nome do banco se for slug conhecido; senão o próprio texto. */
export function bankName(value: string | null | undefined): string {
  if (!value) return "";
  return BY_SLUG.get(value)?.nome ?? value;
}

/** Sigla para o apelido automático: do banco se slug conhecido; senão derivada do texto livre. */
export function bankSigla(value: string | null | undefined): string {
  if (!value) return "";
  const bank = BY_SLUG.get(value);
  if (bank) return bank.sigla;
  const first = value.trim().split(/\s+/)[0] ?? "";
  return first.slice(0, 8).toUpperCase();
}

/**
 * Migração de dados legados: um institution antigo (guardava o nome ou a sigla)
 * vira o slug correspondente; retorna null se não reconhecer (mantém texto livre).
 */
export function slugFromLegacy(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (BY_SLUG.has(v)) return v;
  return BY_NOME.get(v)?.slug ?? BY_SIGLA.get(v)?.slug ?? null;
}
