// Lógica de datas de fatura de cartão de crédito.
// Tudo trabalha com strings yyyy-mm-dd (dia local, sem fuso).

function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}
function clampDay(day: number, y: number, m: number): number {
  return Math.min(day, daysInMonth(y, m));
}
function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface InvoicePeriod {
  periodStart: string;
  periodEnd: string; // data de fechamento
  dueDate: string; // vencimento
}

/**
 * Dado o dia de fechamento/vencimento e a data da compra, calcula a qual
 * fatura a compra pertence (período fechado no `closingDay`).
 */
export function computeInvoicePeriod(closingDay: number, dueDay: number, dateStr: string): InvoicePeriod {
  const date = new Date(dateStr + "T12:00:00");
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();

  // Mês do fechamento (período): se a compra passou do dia de fechamento, vai pro mês seguinte.
  const peBase = new Date(y, m, 1);
  if (d > closingDay) peBase.setMonth(peBase.getMonth() + 1);
  const peY = peBase.getFullYear();
  const peM = peBase.getMonth();

  const periodEnd = new Date(peY, peM, clampDay(closingDay, peY, peM));

  const prevClosing = new Date(peY, peM - 1, clampDay(closingDay, peY, peM - 1));
  const periodStart = new Date(prevClosing);
  periodStart.setDate(periodStart.getDate() + 1);

  // Vencimento no mesmo mês do fechamento se dueDay > closingDay, senão no mês seguinte.
  const dueOffset = dueDay > closingDay ? 0 : 1;
  const dueBase = new Date(peY, peM + dueOffset, 1);
  const dueDate = new Date(dueBase.getFullYear(), dueBase.getMonth(), clampDay(dueDay, dueBase.getFullYear(), dueBase.getMonth()));

  return { periodStart: ymd(periodStart), periodEnd: ymd(periodEnd), dueDate: ymd(dueDate) };
}

/** Soma n meses a uma data yyyy-mm-dd (clampando o dia). */
export function addMonths(dateStr: string, n: number): string {
  const date = new Date(dateStr + "T12:00:00");
  const y = date.getFullYear();
  const m = date.getMonth() + n;
  const targetY = y + Math.floor(m / 12);
  const targetM = ((m % 12) + 12) % 12;
  const day = clampDay(date.getDate(), targetY, targetM);
  return ymd(new Date(targetY, targetM, day));
}

/** Rótulo de situação para exibição: paga / fechada / aberta. */
export function invoiceDisplayStatus(
  status: "open" | "closed" | "paid",
  periodEnd: string,
  today = new Date(),
): "paga" | "fechada" | "aberta" {
  if (status === "paid") return "paga";
  const closed = ymd(today) > periodEnd;
  return closed ? "fechada" : "aberta";
}
