"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUserIdFromSession } from "@/lib/supabase/server";
import { budgetSchema, type BudgetInput } from "@/lib/zod-schemas/budget";
import { firstZodError, type ActionResult } from "@/lib/action-result";

function revalidate() {
  revalidatePath("/orcamentos");
}
const getUserId = getUserIdFromSession;

/** Primeiro dia do mês anterior a um yyyy-mm-01. */
function prevMonth(monthStr: string): string {
  const d = new Date(monthStr + "T12:00:00");
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export async function createBudget(input: BudgetInput): Promise<ActionResult> {
  const parsed = budgetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Não autenticado" };

  const { error } = await supabase.from("budgets").insert({
    user_id: userId,
    category_id: parsed.data.category_id,
    month: parsed.data.month,
    limit_cents: parsed.data.limit_cents,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Já existe orçamento para essa categoria neste mês" };
    return { ok: false, error: error.message };
  }
  revalidate();
  return { ok: true };
}

export async function updateBudget(id: string, limitCents: number): Promise<ActionResult> {
  if (!Number.isInteger(limitCents) || limitCents <= 0) return { ok: false, error: "Valor inválido" };
  const supabase = createClient();
  const { error } = await supabase.from("budgets").update({ limit_cents: limitCents }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function deleteBudget(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("budgets").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

/** Copia os orçamentos do mês anterior para o mês informado (só categorias ainda sem orçamento). */
export async function copyFromPreviousMonth(monthStr: string): Promise<ActionResult> {
  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Não autenticado" };

  const prev = prevMonth(monthStr);
  const [{ data: prevBudgets }, { data: curBudgets }] = await Promise.all([
    supabase.from("budgets").select("category_id,limit_cents").eq("month", prev),
    supabase.from("budgets").select("category_id").eq("month", monthStr),
  ]);
  if (!prevBudgets || prevBudgets.length === 0) {
    return { ok: false, error: "Nenhum orçamento no mês anterior para copiar" };
  }
  const existing = new Set((curBudgets ?? []).map((b) => b.category_id));
  const rows = prevBudgets
    .filter((b) => !existing.has(b.category_id))
    .map((b) => ({ user_id: userId, category_id: b.category_id, month: monthStr, limit_cents: b.limit_cents }));
  if (rows.length === 0) return { ok: false, error: "Todos já têm orçamento neste mês" };

  const { error } = await supabase.from("budgets").insert(rows);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
