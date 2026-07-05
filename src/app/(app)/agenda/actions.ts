"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUserIdFromSession } from "@/lib/supabase/server";
import { recurringSchema, type RecurringInput } from "@/lib/zod-schemas/recurring";
import { advanceDate, type Frequency } from "@/lib/recurrence";
import { firstZodError, type ActionResult } from "@/lib/action-result";

const HORIZON_DAYS = 120;

function revalidate() {
  revalidatePath("/agenda");
  revalidatePath("/lancamentos");
  revalidatePath("/dashboard");
}
function dateToTs(date: string) {
  return `${date}T12:00:00.000Z`;
}
function horizonDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + HORIZON_DAYS);
  return d.toISOString().slice(0, 10);
}
const getUserId = getUserIdFromSession;

interface RuleRow {
  id: string;
  type: "income" | "expense" | "transfer";
  description: string;
  amount_cents: number;
  account_id: string;
  category_id: string | null;
  frequency: Frequency;
  interval: number;
  end_date: string | null;
  occurrences: number | null;
  next_run_date: string;
  active: boolean;
}

/** Gera as ocorrências pendentes de uma regra até o horizonte, de forma idempotente. */
async function materializeRule(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  rule: RuleRow,
  horizon: string,
): Promise<number> {
  if (!rule.active) return 0;

  const { count: alreadyCount } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("recurring_rule_id", rule.id);
  let generated = alreadyCount ?? 0;

  let cursor = rule.next_run_date;
  const rows: {
    user_id: string; type: "income" | "expense"; amount_cents: number; date: string;
    description: string; status: "pending"; account_id: string; category_id: string | null;
    recurring_rule_id: string;
  }[] = [];

  while (cursor <= horizon) {
    if (rule.end_date && cursor > rule.end_date) break;
    if (rule.occurrences && generated >= rule.occurrences) break;
    rows.push({
      user_id: userId,
      type: rule.type === "income" ? "income" : "expense",
      amount_cents: rule.amount_cents,
      date: dateToTs(cursor),
      description: rule.description,
      status: "pending",
      account_id: rule.account_id,
      category_id: rule.category_id,
      recurring_rule_id: rule.id,
    });
    generated++;
    cursor = advanceDate(cursor, rule.frequency, rule.interval);
  }

  if (rows.length) {
    const { error } = await supabase.from("transactions").insert(rows);
    if (error) return 0;
  }

  const ended =
    (!!rule.end_date && cursor > rule.end_date) ||
    (!!rule.occurrences && generated >= rule.occurrences);
  await supabase
    .from("recurring_rules")
    .update({ next_run_date: cursor, active: !ended })
    .eq("id", rule.id);

  return rows.length;
}

export async function materializeRecurring(): Promise<{ created: number }> {
  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return { created: 0 };

  const { data: rules } = await supabase
    .from("recurring_rules")
    .select("id,type,description,amount_cents,account_id,category_id,frequency,interval,end_date,occurrences,next_run_date,active")
    .eq("active", true);

  const horizon = horizonDate();
  let created = 0;
  for (const rule of (rules ?? []) as RuleRow[]) {
    created += await materializeRule(supabase, userId, rule, horizon);
  }
  if (created > 0) revalidate();
  return { created };
}

export async function createRecurringRule(input: RecurringInput): Promise<ActionResult> {
  const parsed = recurringSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Não autenticado" };
  const d = parsed.data;

  const { data: rule, error } = await supabase
    .from("recurring_rules")
    .insert({
      user_id: userId,
      type: d.type,
      description: d.description,
      amount_cents: d.amount_cents,
      account_id: d.account_id,
      category_id: d.category_id || null,
      frequency: d.frequency,
      interval: d.interval,
      start_date: d.start_date,
      end_date: d.end_type === "date" ? d.end_date : null,
      occurrences: d.end_type === "count" ? d.occurrences : null,
      next_run_date: d.start_date,
      active: true,
    })
    .select("id,type,description,amount_cents,account_id,category_id,frequency,interval,end_date,occurrences,next_run_date,active")
    .single();
  if (error || !rule) return { ok: false, error: error?.message ?? "Erro ao salvar" };

  await materializeRule(supabase, userId, rule as RuleRow, horizonDate());
  revalidate();
  return { ok: true };
}

export async function updateRecurringRule(id: string, input: RecurringInput): Promise<ActionResult> {
  const parsed = recurringSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const supabase = createClient();
  const d = parsed.data;
  const { error } = await supabase
    .from("recurring_rules")
    .update({
      type: d.type,
      description: d.description,
      amount_cents: d.amount_cents,
      account_id: d.account_id,
      category_id: d.category_id || null,
      frequency: d.frequency,
      interval: d.interval,
      start_date: d.start_date,
      end_date: d.end_type === "date" ? d.end_date : null,
      occurrences: d.end_type === "count" ? d.occurrences : null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function toggleRecurringActive(id: string, active: boolean): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("recurring_rules").update({ active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

/** Exclui a regra e as ocorrências previstas (não realizadas) que ela gerou. */
export async function deleteRecurringRule(id: string): Promise<ActionResult> {
  const supabase = createClient();
  await supabase
    .from("transactions")
    .delete()
    .eq("recurring_rule_id", id)
    .eq("status", "pending");
  const { error } = await supabase.from("recurring_rules").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
