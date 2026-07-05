import { addMonths } from "@/lib/card-invoice";

export type Frequency = "daily" | "weekly" | "monthly" | "yearly";

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily: "Diária",
  weekly: "Semanal",
  monthly: "Mensal",
  yearly: "Anual",
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Avança uma data (yyyy-mm-dd) conforme a frequência e o intervalo. */
export function advanceDate(dateStr: string, freq: Frequency, interval: number): string {
  if (freq === "monthly") return addMonths(dateStr, interval);
  if (freq === "yearly") return addMonths(dateStr, interval * 12);
  const d = new Date(dateStr + "T12:00:00");
  if (freq === "daily") d.setDate(d.getDate() + interval);
  else d.setDate(d.getDate() + interval * 7); // weekly
  return ymd(d);
}

/** Descrição legível da cadência (ex.: "Mensal", "A cada 2 semanas"). */
export function describeCadence(freq: Frequency, interval: number): string {
  if (interval === 1) return FREQUENCY_LABELS[freq];
  const unit = { daily: "dias", weekly: "semanas", monthly: "meses", yearly: "anos" }[freq];
  return `A cada ${interval} ${unit}`;
}
