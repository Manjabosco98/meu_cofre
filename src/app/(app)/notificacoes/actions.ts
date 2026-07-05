"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUserIdFromSession } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/format";
import type { ActionResult } from "@/lib/action-result";

type NotificationType = "bill_due" | "budget_exceeded" | "goal_achieved" | "general";

interface CandidateNotification {
  type: NotificationType;
  related_id: string;
  title: string;
  body: string;
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function currentMonthFirst() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function currentMonthLast() {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
}

const getUserId = getUserIdFromSession;

export async function generateNotifications(): Promise<{ ok: true; created: number } | { ok: false; error: string }> {
  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Não autenticado" };

  const today = todayYmd();
  const soon = addDays(today, 5);
  const monthFirst = currentMonthFirst();
  const monthEnd = currentMonthLast();

  const [
    { data: pending },
    { data: invoices },
    { data: budgets },
    { data: categories },
    { data: monthExpenses },
    { data: goals },
    { data: contributions },
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("id,type,amount_cents,date,description")
      .eq("status", "pending")
      .lte("date", `${soon}T23:59:59Z`)
      .order("date", { ascending: true }),
    supabase
      .from("invoices")
      .select("id,due_date,status,credit_card:credit_cards(account:accounts!credit_cards_account_id_fkey(name))")
      .neq("status", "paid")
      .lte("due_date", soon)
      .order("due_date", { ascending: true }),
    supabase.from("budgets").select("id,category_id,limit_cents").eq("month", monthFirst),
    supabase.from("categories").select("id,name,parent_id"),
    supabase
      .from("transactions")
      .select("amount_cents,category_id")
      .eq("status", "cleared")
      .eq("type", "expense")
      .gte("date", `${monthFirst}T00:00:00Z`)
      .lte("date", `${monthEnd}T23:59:59Z`),
    supabase.from("goals").select("id,name,target_cents,status").eq("status", "active"),
    supabase.from("goal_contributions").select("goal_id,amount_cents"),
  ]);

  const candidates: CandidateNotification[] = [];

  for (const tx of pending ?? []) {
    const date = tx.date.slice(0, 10);
    const overdue = date < today;
    const isIncome = tx.type === "income";
    candidates.push({
      type: "bill_due",
      related_id: tx.id,
      title: overdue ? "Lançamento em atraso" : "Lançamento a vencer",
      body: `${isIncome ? "Receber" : "Pagar"} ${formatBRL(tx.amount_cents)} - ${tx.description}`,
    });
  }

  for (const invoice of invoices ?? []) {
    const cardName =
      (invoice.credit_card as unknown as { account?: { name?: string } | null } | null)?.account?.name ?? "Cartão";
    candidates.push({
      type: "bill_due",
      related_id: invoice.id,
      title: invoice.due_date < today ? "Fatura em atraso" : "Fatura a vencer",
      body: `${cardName} vence em ${invoice.due_date.slice(0, 10)}`,
    });
  }

  const catMap = new Map((categories ?? []).map((cat) => [cat.id, cat]));
  const budgetMap = new Map((budgets ?? []).map((budget) => [budget.category_id, budget]));
  const spentByBudget = new Map<string, number>();
  for (const tx of monthExpenses ?? []) {
    if (!tx.category_id) continue;
    let target: string | null = null;
    if (budgetMap.has(tx.category_id)) target = tx.category_id;
    else {
      const cat = catMap.get(tx.category_id);
      if (cat?.parent_id && budgetMap.has(cat.parent_id)) target = cat.parent_id;
    }
    if (target) spentByBudget.set(target, (spentByBudget.get(target) ?? 0) + tx.amount_cents);
  }
  for (const budget of budgets ?? []) {
    const spent = spentByBudget.get(budget.category_id) ?? 0;
    if (spent <= budget.limit_cents) continue;
    const cat = catMap.get(budget.category_id);
    candidates.push({
      type: "budget_exceeded",
      related_id: budget.id,
      title: "Orçamento estourado",
      body: `${cat?.name ?? "Categoria"}: ${formatBRL(spent)} de ${formatBRL(budget.limit_cents)}`,
    });
  }

  const contributionsByGoal = new Map<string, number>();
  for (const c of contributions ?? []) {
    contributionsByGoal.set(c.goal_id, (contributionsByGoal.get(c.goal_id) ?? 0) + c.amount_cents);
  }
  for (const goal of goals ?? []) {
    const current = contributionsByGoal.get(goal.id) ?? 0;
    if (current < goal.target_cents) continue;
    candidates.push({
      type: "goal_achieved",
      related_id: goal.id,
      title: "Meta atingida",
      body: `${goal.name}: ${formatBRL(current)} de ${formatBRL(goal.target_cents)}`,
    });
  }

  if (!candidates.length) return { ok: true, created: 0 };

  const { data: existing, error: existingError } = await supabase
    .from("notifications")
    .select("type,related_id")
    .in("related_id", candidates.map((c) => c.related_id));
  if (existingError) return { ok: false, error: existingError.message };

  const existingKeys = new Set((existing ?? []).map((n) => `${n.type}:${n.related_id}`));
  const rows = candidates
    .filter((c) => !existingKeys.has(`${c.type}:${c.related_id}`))
    .map((c) => ({ ...c, user_id: userId }));

  if (!rows.length) return { ok: true, created: 0 };
  const { error } = await supabase.from("notifications").insert(rows);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/notificacoes");
  return { ok: true, created: rows.length };
}

export async function setNotificationRead(id: string, read: boolean): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: read ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/notificacoes");
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/notificacoes");
  return { ok: true };
}

export async function deleteNotification(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/notificacoes");
  return { ok: true };
}
