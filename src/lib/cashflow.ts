// Helpers do fluxo de caixa: granularidade dia/semana/mês.

export type Granularity = "day" | "week" | "month";

export const GRANULARITY_LABELS: Record<Granularity, string> = {
  day: "Dia",
  week: "Semana",
  month: "Mês",
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function ymd(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "0";
  const m = parts.find((p) => p.type === "month")?.value ?? "0";
  const dd = parts.find((p) => p.type === "day")?.value ?? "0";
  return `${y}-${m}-${dd}`;
}

/** Início do período (dia/semana começando na segunda/mês) que contém a data. */
export function periodStart(date: Date, g: Granularity): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (g === "day") return d;
  if (g === "month") return new Date(d.getFullYear(), d.getMonth(), 1);
  // week: segunda-feira
  const dow = (d.getDay() + 6) % 7; // 0 = segunda
  d.setDate(d.getDate() - dow);
  return d;
}

/** Fim do período que começa em `start`. */
export function periodEnd(start: Date, g: Granularity): Date {
  if (g === "day") return start;
  if (g === "week") {
    const e = new Date(start);
    e.setDate(e.getDate() + 6);
    return e;
  }
  return new Date(start.getFullYear(), start.getMonth() + 1, 0);
}

export function nextPeriod(start: Date, g: Granularity): Date {
  if (g === "day") return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  if (g === "week") return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  return new Date(start.getFullYear(), start.getMonth() + 1, 1);
}

export function periodKey(start: Date, g: Granularity): string {
  return g === "month" ? `${start.getFullYear()}-${pad(start.getMonth() + 1)}` : ymd(start);
}

export function periodLabel(start: Date, g: Granularity): string {
  if (g === "month") {
    return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "America/Sao_Paulo" }).format(start).replace(".", "");
  }
  if (g === "week") {
    const end = periodEnd(start, g);
    const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
    return `${fmt.format(start)} a ${fmt.format(end)}`;
  }
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }).format(start);
}

/** Janela [start, end] conforme a granularidade, centrada em `today`. */
export function getRange(g: Granularity, today: Date): { start: Date; end: Date } {
  if (g === "day") {
    return {
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 10),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 45),
    };
  }
  if (g === "week") {
    return {
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 28),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 112),
    };
  }
  return {
    start: new Date(today.getFullYear(), today.getMonth() - 2, 1),
    end: new Date(today.getFullYear(), today.getMonth() + 10, 1),
  };
}

/** Lista de inícios de período de start até end (inclusive). */
export function iteratePeriods(start: Date, end: Date, g: Granularity): Date[] {
  const out: Date[] = [];
  let cur = periodStart(start, g);
  const last = periodStart(end, g);
  while (cur <= last) {
    out.push(cur);
    cur = nextPeriod(cur, g);
  }
  return out;
}

export { ymd as ymdLocal };
