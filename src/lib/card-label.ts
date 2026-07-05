// Rótulo/apelido derivável de um cartão: banco + final ("Nubank •••• 1234").
// Usado no formulário (preview do apelido automático) e nas actions (nome ao salvar
// quando o apelido está vazio). Mantém o card sempre com um rótulo mesmo sem apelido.
export function deriveCardLabel(
  institution: string | null | undefined,
  last4: string | null | undefined,
): string {
  const bank = (institution ?? "").trim();
  const l4 = (last4 ?? "").trim();
  if (bank && l4) return `${bank} •••• ${l4}`;
  if (bank) return bank;
  if (l4) return `•••• ${l4}`;
  return "Cartão";
}
