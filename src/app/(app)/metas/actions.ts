"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUserIdFromSession } from "@/lib/supabase/server";
import { goalSchema, contributionSchema, type GoalInput, type ContributionInput } from "@/lib/zod-schemas/goal";
import { firstZodError, type ActionResult } from "@/lib/action-result";

function revalidate() {
  revalidatePath("/metas");
  revalidatePath("/dashboard");
}
function dateToTs(date: string) {
  return `${date}T12:00:00.000Z`;
}
const getUserId = getUserIdFromSession;

export async function createGoal(input: GoalInput): Promise<ActionResult> {
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Não autenticado" };
  const d = parsed.data;
  const { error } = await supabase.from("goals").insert({
    user_id: userId,
    name: d.name,
    target_cents: d.target_cents,
    deadline: d.deadline || null,
    color: d.color,
    recurring_contribution_cents: d.recurring_contribution_cents || null,
    contribution_frequency: d.contribution_frequency || null,
    start_date: d.start_date || null,
    account_id: d.account_id || null,
    status: "active",
  });
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function updateGoal(id: string, input: GoalInput): Promise<ActionResult> {
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
  const supabase = createClient();
  const d = parsed.data;
  const { error } = await supabase
    .from("goals")
    .update({
      name: d.name,
      target_cents: d.target_cents,
      deadline: d.deadline || null,
      color: d.color,
      recurring_contribution_cents: d.recurring_contribution_cents || null,
      contribution_frequency: d.contribution_frequency || null,
      start_date: d.start_date || null,
      account_id: d.account_id || null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function deleteGoal(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function setGoalArchived(id: string, archived: boolean): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("goals").update({ status: archived ? "archived" : "active" }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

/** Alterna status da meta (active/paused). */
export async function setGoalStatus(id: string, status: "active" | "paused"): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("goals").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function addContribution(input: ContributionInput): Promise<ActionResult> {
  const parsed = contributionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Não autenticado" };
  const d = parsed.data;
  const amount = d.type === "withdrawal" ? -Math.abs(d.amount_cents) : Math.abs(d.amount_cents);
  const { error } = await supabase.from("goal_contributions").insert({
    user_id: userId,
    goal_id: d.goal_id,
    amount_cents: amount,
    date: dateToTs(d.date),
    note: d.note || null,
    type: d.type,
  });
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function deleteContribution(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("goal_contributions").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
