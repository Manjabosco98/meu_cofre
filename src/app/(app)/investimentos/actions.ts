"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUserIdFromSession } from "@/lib/supabase/server";
import {
  investmentSchema,
  investmentEntrySchema,
  type InvestmentInput,
  type InvestmentEntryInput,
} from "@/lib/zod-schemas/investment";
import { firstZodError, type ActionResult } from "@/lib/action-result";

function revalidate() {
  revalidatePath("/investimentos");
  revalidatePath("/patrimonio");
  revalidatePath("/dashboard");
}
function dateToTs(date: string) {
  return `${date}T12:00:00.000Z`;
}
const getUserId = getUserIdFromSession;

export async function createInvestment(input: InvestmentInput): Promise<ActionResult> {
  const parsed = investmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Não autenticado" };
  const d = parsed.data;
  const { error } = await supabase.from("investments").insert({
    user_id: userId,
    name: d.name,
    type: d.type,
    current_value_cents: d.current_value_cents,
  });
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function updateInvestment(id: string, input: InvestmentInput): Promise<ActionResult> {
  const parsed = investmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
  const supabase = createClient();
  const d = parsed.data;
  const { error } = await supabase
    .from("investments")
    .update({
      name: d.name,
      type: d.type,
      current_value_cents: d.current_value_cents,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function updateInvestmentValue(id: string, currentValueCents: number): Promise<ActionResult> {
  if (!Number.isInteger(currentValueCents) || currentValueCents < 0)
    return { ok: false, error: "Valor inválido" };
  const supabase = createClient();
  const { error } = await supabase
    .from("investments")
    .update({ current_value_cents: currentValueCents, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function deleteInvestment(id: string): Promise<ActionResult> {
  const supabase = createClient();
  // Remove os aportes/resgates antes (sem cascade garantido no schema).
  await supabase.from("investment_entries").delete().eq("investment_id", id);
  const { error } = await supabase.from("investments").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function addInvestmentEntry(input: InvestmentEntryInput): Promise<ActionResult> {
  const parsed = investmentEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Não autenticado" };
  const d = parsed.data;
  const { error } = await supabase.from("investment_entries").insert({
    user_id: userId,
    investment_id: d.investment_id,
    amount_cents: d.amount_cents,
    type: d.type,
    date: dateToTs(d.date),
    note: d.note || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function deleteInvestmentEntry(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("investment_entries").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
