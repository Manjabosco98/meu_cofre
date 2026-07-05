"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient, getUserIdFromSession } from "@/lib/supabase/server";
import {
  cardSchema, purchaseSchema, payInvoiceSchema, subscriptionSchema,
  type CardInput, type PurchaseInput, type PayInvoiceInput, type SubscriptionInput,
} from "@/lib/zod-schemas/card";
import { computeInvoicePeriod, addMonths } from "@/lib/card-invoice";
import { advanceDate, type Frequency } from "@/lib/recurrence";
import { deriveCardLabel } from "@/lib/card-label";
import { bankName } from "@/lib/banks";
import { firstZodError, type ActionResult } from "@/lib/action-result";

/**
 * Banco efetivo do cartão: herdado da conta vinculada (quando houver) ou o
 * informado manualmente. Denormalizado em accounts.institution para o card exibir
 * direto. O nome (rótulo) é o apelido ou, se vazio, o rótulo derivado (banco + final).
 */
async function resolveCardIdentity(
  supabase: ReturnType<typeof createClient>,
  d: { linked_account_id?: string | null; institution?: string | null; apelido?: string | null; last4?: string | null },
): Promise<{ institution: string | null; name: string }> {
  let institution = d.institution?.trim() || null;
  if (d.linked_account_id) {
    const { data: linked } = await supabase
      .from("accounts")
      .select("institution")
      .eq("id", d.linked_account_id)
      .maybeSingle();
    institution = linked?.institution ?? null;
  }
  // institution guarda o slug (herdado) ou texto livre; o rótulo usa o nome humano.
  const name = d.apelido?.trim() || deriveCardLabel(bankName(institution), d.last4);
  return { institution, name };
}

function revalidate() {
  revalidatePath("/cartoes");
  revalidatePath("/dashboard");
  revalidatePath("/contas");
}
function dateToTs(date: string) {
  return `${date}T12:00:00.000Z`;
}
const getUserId = getUserIdFromSession;

/** Encontra ou cria a fatura correta do cartão para a data informada. */
async function ensureInvoice(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  cardId: string,
  closingDay: number,
  dueDay: number,
  dateStr: string,
): Promise<string | null> {
  const { periodStart, periodEnd, dueDate } = computeInvoicePeriod(closingDay, dueDay, dateStr);
  const { data: existing } = await supabase
    .from("invoices")
    .select("id")
    .eq("credit_card_id", cardId)
    .eq("period_end", periodEnd)
    .maybeSingle();
  if (existing) return existing.id;

  const { data } = await supabase
    .from("invoices")
    .insert({
      user_id: userId,
      credit_card_id: cardId,
      period_start: periodStart,
      period_end: periodEnd,
      due_date: dueDate,
      status: "open",
    })
    .select("id")
    .single();
  return data?.id ?? null;
}

// ---------------------------------------------------------------------------
// Cartão (conta credit_card + credit_card)
// ---------------------------------------------------------------------------

export async function createCard(input: CardInput): Promise<ActionResult> {
  const parsed = cardSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Não autenticado" };
  const d = parsed.data;

  const { institution, name } = await resolveCardIdentity(supabase, d);
  const { data: account, error: accErr } = await supabase
    .from("accounts")
    .insert({
      user_id: userId,
      name,
      type: "credit_card",
      institution,
      initial_balance_cents: 0,
      color: d.color,
      icon: "credit-card",
    })
    .select("id")
    .single();
  if (accErr || !account) return { ok: false, error: accErr?.message ?? "Erro ao criar conta" };

  const { error: cardErr } = await supabase.from("credit_cards").insert({
    user_id: userId,
    account_id: account.id,
    limit_cents: d.limit_cents,
    closing_day: d.closing_day,
    due_day: d.due_day,
    brand: d.brand || null,
    last4: d.last4 || null,
    linked_account_id: d.linked_account_id || null,
  });
  if (cardErr) {
    await supabase.from("accounts").delete().eq("id", account.id); // rollback manual
    return { ok: false, error: cardErr.message };
  }
  revalidate();
  return { ok: true };
}

export async function updateCard(
  cardId: string,
  accountId: string,
  input: CardInput,
): Promise<ActionResult> {
  const parsed = cardSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
  const supabase = createClient();
  const d = parsed.data;

  const { institution, name } = await resolveCardIdentity(supabase, d);
  const { error: accErr } = await supabase
    .from("accounts")
    .update({ name, color: d.color, institution })
    .eq("id", accountId);
  if (accErr) return { ok: false, error: accErr.message };

  const { error } = await supabase
    .from("credit_cards")
    .update({
      limit_cents: d.limit_cents,
      closing_day: d.closing_day,
      due_day: d.due_day,
      brand: d.brand || null,
      last4: d.last4 || null,
      linked_account_id: d.linked_account_id || null,
    })
    .eq("id", cardId);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function deleteCard(accountId: string): Promise<ActionResult> {
  const supabase = createClient();
  // Excluir a conta cascateia credit_card, invoices e transações.
  const { error } = await supabase.from("accounts").delete().eq("id", accountId);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Compra (com parcelamento)
// ---------------------------------------------------------------------------

export async function createCardPurchase(input: PurchaseInput): Promise<ActionResult> {
  const parsed = purchaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Não autenticado" };
  const d = parsed.data;

  const { data: card } = await supabase
    .from("credit_cards")
    .select("id, account_id, closing_day, due_day")
    .eq("id", d.card_id)
    .single();
  if (!card) return { ok: false, error: "Cartão não encontrado" };

  const n = d.installments;
  const base = Math.floor(d.amount_cents / n);
  const remainder = d.amount_cents - base * n;
  const group = n > 1 ? randomUUID() : null;

  for (let i = 0; i < n; i++) {
    const parcelDate = addMonths(d.date, i);
    const invoiceId = await ensureInvoice(
      supabase, userId, card.id, card.closing_day, card.due_day, parcelDate,
    );
    const amount = i === 0 ? base + remainder : base;
    const desc = n > 1 ? `${d.description} (${i + 1}/${n})` : d.description;

    const { error } = await supabase.from("transactions").insert({
      user_id: userId,
      type: "expense",
      amount_cents: amount,
      date: dateToTs(parcelDate),
      description: desc,
      status: "cleared",
      account_id: card.account_id,
      category_id: d.category_id || null,
      invoice_id: invoiceId,
      installment_group_id: group,
      installment_no: n > 1 ? i + 1 : null,
      installment_total: n > 1 ? n : null,
    });
    if (error) return { ok: false, error: error.message };
  }
  revalidate();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Pagamento de fatura (transferência conta -> cartão)
// ---------------------------------------------------------------------------

export async function payInvoice(input: PayInvoiceInput): Promise<ActionResult> {
  const parsed = payInvoiceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Não autenticado" };
  const d = parsed.data;

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, credit_card_id, credit_card:credit_cards(account_id)")
    .eq("id", d.invoice_id)
    .single();
  const cardAccountId = (invoice?.credit_card as unknown as { account_id: string } | null)?.account_id;
  if (!invoice || !cardAccountId) return { ok: false, error: "Fatura não encontrada" };
  if (cardAccountId === d.from_account_id) {
    return { ok: false, error: "A conta de origem não pode ser o próprio cartão" };
  }

  const group = randomUUID();
  const ts = dateToTs(d.date);
  const { data: legs, error } = await supabase
    .from("transactions")
    .insert([
      {
        user_id: userId, type: "transfer", amount_cents: -d.amount_cents, date: ts,
        description: "Pagamento de fatura", status: "cleared",
        account_id: d.from_account_id, transfer_group_id: group,
      },
      {
        user_id: userId, type: "transfer", amount_cents: d.amount_cents, date: ts,
        description: "Pagamento de fatura", status: "cleared",
        account_id: cardAccountId, transfer_group_id: group,
      },
    ])
    .select("id, amount_cents");
  if (error || !legs) return { ok: false, error: error?.message ?? "Erro ao pagar" };

  const destLeg = legs.find((l) => l.amount_cents > 0);
  const { error: updErr } = await supabase
    .from("invoices")
    .update({ status: "paid", paid_transaction_id: destLeg?.id ?? null })
    .eq("id", d.invoice_id);
  if (updErr) return { ok: false, error: updErr.message };

  revalidate();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Assinaturas recorrentes
// ---------------------------------------------------------------------------

const HORIZON_DAYS = 120;

/** Cria assinatura e lança a 1ª cobrança na fatura correta. */
export async function createCardSubscription(input: PurchaseInput): Promise<ActionResult> {
  const parsed = purchaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
  if (!parsed.data.is_recurring) return { ok: false, error: "Use createCardPurchase para compras não-recorrentes" };

  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Não autenticado" };
  const d = parsed.data;

  const { data: card } = await supabase
    .from("credit_cards")
    .select("id, account_id, closing_day, due_day")
    .eq("id", d.card_id)
    .single();
  if (!card) return { ok: false, error: "Cartão não encontrado" };

  // 1. Criar assinatura
  const nextBilling = d.date;
  const { data: sub, error: subErr } = await supabase
    .from("recurring_subscriptions")
    .insert({
      user_id: userId,
      credit_card_id: card.id,
      description: d.description,
      amount_cents: d.amount_cents,
      category_id: d.category_id || null,
      frequency: d.subscription_frequency!,
      interval: 1,
      start_date: d.date,
      end_date: d.subscription_end_date || null,
      status: d.subscription_status ?? "active",
      next_billing_date: nextBilling,
      active: (d.subscription_status ?? "active") === "active",
    })
    .select("id")
    .single();
  if (subErr || !sub) return { ok: false, error: subErr?.message ?? "Erro ao criar assinatura" };

  // 2. Lançar 1ª cobrança na fatura
  const invoiceId = await ensureInvoice(
    supabase, userId, card.id, card.closing_day, card.due_day, d.date,
  );
  const { error: txErr } = await supabase.from("transactions").insert({
    user_id: userId,
    type: "expense",
    amount_cents: d.amount_cents,
    date: dateToTs(d.date),
    description: d.description,
    status: "cleared",
    account_id: card.account_id,
    category_id: d.category_id || null,
    invoice_id: invoiceId,
    recurring_subscription_id: sub.id,
  });
  if (txErr) return { ok: false, error: txErr.message };

  // 3. Avançar next_billing_date para a próxima cobrança
  const nextDate = advanceDate(d.date, d.subscription_frequency!, 1);
  await supabase
    .from("recurring_subscriptions")
    .update({ next_billing_date: nextDate })
    .eq("id", sub.id);

  revalidate();
  return { ok: true };
}

/** Gera cobranças futuras para assinaturas ativas (idempotente). */
export async function materializeSubscriptions(): Promise<number> {
  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return 0;

  const today = new Date().toISOString().slice(0, 10);
  const horizonDate = new Date(Date.now() + HORIZON_DAYS * 86400000).toISOString().slice(0, 10);

  const { data: subs } = await supabase
    .from("recurring_subscriptions")
    .select("id, credit_card_id, description, amount_cents, category_id, frequency, interval, next_billing_date, end_date, active")
    .eq("user_id", userId)
    .eq("active", true);

  if (!subs?.length) return 0;

  let totalGenerated = 0;

  for (const sub of subs as {
    id: string; credit_card_id: string; description: string; amount_cents: number;
    category_id: string | null; frequency: Frequency; interval: number;
    next_billing_date: string; end_date: string | null; active: boolean;
  }[]) {
    // Buscar dados do cartão
    const { data: card } = await supabase
      .from("credit_cards")
      .select("id, account_id, closing_day, due_day")
      .eq("id", sub.credit_card_id)
      .single();
    if (!card) continue;

    // Contar cobranças já geradas (idempotência)
    const { count: alreadyCount } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("recurring_subscription_id", sub.id);
    let generated = alreadyCount ?? 0;

    let cursor = sub.next_billing_date;
    const rows: {
      user_id: string; type: "expense"; amount_cents: number; date: string;
      description: string; status: "cleared"; account_id: string;
      category_id: string | null; recurring_subscription_id: string;
      invoice_id: string | null;
    }[] = [];

    while (cursor <= horizonDate) {
      if (sub.end_date && cursor > sub.end_date) break;

      const invoiceId = await ensureInvoice(
        supabase, userId, card.id, card.closing_day, card.due_day, cursor,
      );
      rows.push({
        user_id: userId,
        type: "expense",
        amount_cents: sub.amount_cents,
        date: dateToTs(cursor),
        description: sub.description,
        status: "cleared",
        account_id: card.account_id,
        category_id: sub.category_id,
        recurring_subscription_id: sub.id,
        invoice_id: invoiceId,
      });
      generated++;
      cursor = advanceDate(cursor, sub.frequency, sub.interval);
    }

    if (rows.length) {
      const { error } = await supabase.from("transactions").insert(rows);
      if (!error) totalGenerated += rows.length;
    }

    // Atualizar cursor
    const ended = !!sub.end_date && cursor > sub.end_date;
    await supabase
      .from("recurring_subscriptions")
      .update({ next_billing_date: cursor, active: !ended })
      .eq("id", sub.id);
  }

  if (totalGenerated > 0) revalidate();
  return totalGenerated;
}

/** Atualiza metadados de uma assinatura (não altera cobranças já geradas). */
export async function updateCardSubscription(
  id: string, input: SubscriptionInput,
): Promise<ActionResult> {
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const supabase = createClient();
  const d = parsed.data;
  const { error } = await supabase
    .from("recurring_subscriptions")
    .update({
      description: d.description,
      amount_cents: d.amount_cents,
      category_id: d.category_id || null,
      frequency: d.frequency,
      interval: d.interval,
      start_date: d.start_date,
      end_date: d.end_date || null,
      status: d.status,
      active: d.status === "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

/** Alterna status da assinatura (active/paused/cancelled). */
export async function toggleSubscriptionStatus(
  id: string, status: "active" | "paused" | "cancelled",
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("recurring_subscriptions")
    .update({ status, active: status === "active", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

/** Exclui assinatura e transações futuras vinculadas (preserva histórico). */
export async function deleteSubscription(id: string): Promise<ActionResult> {
  const supabase = createClient();
  // Excluir transações futuras vinculadas (com data >= hoje)
  const today = new Date().toISOString().slice(0, 10);
  await supabase
    .from("transactions")
    .delete()
    .eq("recurring_subscription_id", id)
    .gte("date", `${today}T00:00:00Z`);
  // Excluir assinatura
  const { error } = await supabase.from("recurring_subscriptions").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
