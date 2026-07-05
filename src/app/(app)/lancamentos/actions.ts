"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient, getUserIdFromSession } from "@/lib/supabase/server";
import { transactionSchema, type TransactionInput } from "@/lib/zod-schemas/transaction";
import { attachmentInputSchema, type AttachmentInput } from "@/lib/zod-schemas/attachment";
import { advanceDate, type Frequency } from "@/lib/recurrence";
import { firstZodError, type ActionResult } from "@/lib/action-result";

const RECURRENCE_HORIZON_DAYS = 120;

function revalidate() {
  revalidatePath("/lancamentos");
  revalidatePath("/dashboard");
  revalidatePath("/contas");
  revalidatePath("/agenda");
}

/** Guarda o dia informado como meio-dia UTC (não desloca o dia no fuso BRT). */
function dateToTs(date: string): string {
  return `${date}T12:00:00.000Z`;
}

const getUserId = getUserIdFromSession;

async function replaceTags(transactionId: string, tagIds: string[]) {
  const supabase = createClient();
  await supabase.from("transaction_tags").delete().eq("transaction_id", transactionId);
  if (tagIds.length) {
    await supabase
      .from("transaction_tags")
      .insert(tagIds.map((tag_id) => ({ transaction_id: transactionId, tag_id })));
  }
}

// ---------------------------------------------------------------------------
// Criar
// ---------------------------------------------------------------------------

export async function createTransaction(input: TransactionInput): Promise<ActionResult> {
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Não autenticado" };

  const d = parsed.data;
  const ts = dateToTs(d.date);

  if (d.type === "transfer") {
    const group = randomUUID();
    const { error } = await supabase.from("transactions").insert([
      {
        user_id: userId,
        type: "transfer",
        amount_cents: -d.amount_cents, // saída da origem
        date: ts,
        description: d.description,
        notes: d.notes || null,
        status: d.status,
        account_id: d.account_id,
        transfer_group_id: group,
      },
      {
        user_id: userId,
        type: "transfer",
        amount_cents: d.amount_cents, // entrada no destino
        date: ts,
        description: d.description,
        notes: d.notes || null,
        status: d.status,
        account_id: d.to_account_id!,
        transfer_group_id: group,
      },
    ]);
    if (error) return { ok: false, error: error.message };
    revalidate();
    return { ok: true };
  }

  // Receita ou despesa (valor sempre positivo; o sinal é dado pelo tipo).
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      type: d.type,
      amount_cents: d.amount_cents,
      valor_previsto: d.amount_cents,
      valor_realizado: d.status === "cleared" ? (d.valor_realizado ?? d.amount_cents) : null,
      date: ts,
      description: d.description,
      notes: d.notes || null,
      status: d.status,
      account_id: d.account_id,
      category_id: d.category_id || null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Erro ao salvar" };

  await replaceTags(data.id, d.tag_ids);

  // Criar regra de recorrência se solicitado
  if (d.recurrence && data.id) {
    const r = d.recurrence;
    const endDate = r.end_type === "date" ? r.end_date || null : null;
    const occurrences = r.end_type === "count" ? r.occurrences || null : null;

    const { data: rule, error: ruleErr } = await supabase
      .from("recurring_rules")
      .insert({
        user_id: userId,
        type: d.type,
        description: d.description,
        amount_cents: d.amount_cents,
        account_id: d.account_id,
        category_id: d.category_id || null,
        frequency: r.frequency as Frequency,
        interval: r.interval,
        start_date: d.date,
        end_date: endDate,
        occurrences: occurrences,
        next_run_date: d.date,
        active: true,
      })
      .select("id")
      .single();
    if (ruleErr) return { ok: false, error: ruleErr.message };

    // Vincular transação à regra
    await supabase.from("transactions").update({ recurring_rule_id: rule.id }).eq("id", data.id);

    // Materializar próximas ocorrências (a partir da segunda, já que a primeira é esta transação)
    const horizonDate = new Date(Date.now() + RECURRENCE_HORIZON_DAYS * 86400000).toISOString().slice(0, 10);
    let cursor = advanceDate(d.date, r.frequency as Frequency, r.interval);
    const genRows: {
      user_id: string; type: "income" | "expense"; amount_cents: number; date: string;
      description: string; status: "pending"; account_id: string; category_id: string | null;
      recurring_rule_id: string;
    }[] = [];
    let generated = 1; // já existe a primeira transação

    while (cursor <= horizonDate) {
      if (endDate && cursor > endDate) break;
      if (occurrences && generated >= occurrences) break;
      genRows.push({
        user_id: userId,
        type: d.type,
        amount_cents: d.amount_cents,
        date: dateToTs(cursor),
        description: d.description,
        status: "pending",
        account_id: d.account_id,
        category_id: d.category_id || null,
        recurring_rule_id: rule.id,
      });
      generated++;
      cursor = advanceDate(cursor, r.frequency as Frequency, r.interval);
    }
    if (genRows.length) {
      await supabase.from("transactions").insert(genRows);
    }
    // Atualizar cursor e status da regra
    const ended = (!!endDate && cursor > endDate) || (!!occurrences && generated >= occurrences);
    await supabase
      .from("recurring_rules")
      .update({ next_run_date: cursor, active: !ended })
      .eq("id", rule.id);
  }

  revalidate();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Editar
// ---------------------------------------------------------------------------

export async function updateTransaction(id: string, input: TransactionInput): Promise<ActionResult> {
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const supabase = createClient();
  const d = parsed.data;
  const { error } = await supabase
    .from("transactions")
    .update({
      type: d.type,
      amount_cents: d.amount_cents,
      valor_previsto: d.amount_cents,
      valor_realizado: d.status === "cleared" ? (d.valor_realizado ?? d.amount_cents) : null,
      date: dateToTs(d.date),
      description: d.description,
      notes: d.notes || null,
      status: d.status,
      account_id: d.account_id,
      category_id: d.category_id || null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await replaceTags(id, d.tag_ids);
  revalidate();
  return { ok: true };
}

/** Edita uma transferência regravando as duas pernas com o mesmo grupo. */
export async function updateTransfer(groupId: string, input: TransactionInput): Promise<ActionResult> {
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
  if (parsed.data.type !== "transfer") return { ok: false, error: "Tipo inválido" };

  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Não autenticado" };

  const d = parsed.data;
  const ts = dateToTs(d.date);

  const { error: delErr } = await supabase
    .from("transactions")
    .delete()
    .eq("transfer_group_id", groupId);
  if (delErr) return { ok: false, error: delErr.message };

  const { error } = await supabase.from("transactions").insert([
    {
      user_id: userId,
      type: "transfer",
      amount_cents: -d.amount_cents,
      date: ts,
      description: d.description,
      notes: d.notes || null,
      status: d.status,
      account_id: d.account_id,
      transfer_group_id: groupId,
    },
    {
      user_id: userId,
      type: "transfer",
      amount_cents: d.amount_cents,
      date: ts,
      description: d.description,
      notes: d.notes || null,
      status: d.status,
      account_id: d.to_account_id!,
      transfer_group_id: groupId,
    },
  ]);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Status / excluir / duplicar
// ---------------------------------------------------------------------------

export async function setTransactionStatus(
  id: string,
  status: "pending" | "cleared",
  transferGroupId?: string | null,
  valorRealizado?: number | null,
): Promise<ActionResult> {
  const supabase = createClient();
  const update: {
    status: "pending" | "cleared";
    valor_realizado?: number | null;
    data_realizacao?: null;
  } = { status };
  if (status === "cleared" && valorRealizado != null) {
    update.valor_realizado = valorRealizado;
  } else if (status === "pending") {
    update.valor_realizado = null;
    update.data_realizacao = null;
  }
  const q = supabase.from("transactions").update(update);
  const { error } = transferGroupId
    ? await q.eq("transfer_group_id", transferGroupId)
    : await q.eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function deleteTransaction(
  id: string,
  transferGroupId?: string | null,
): Promise<ActionResult> {
  const supabase = createClient();
  const q = supabase.from("transactions").delete();
  const { error } = transferGroupId
    ? await q.eq("transfer_group_id", transferGroupId)
    : await q.eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

/** Duplica um lançamento (ou par de transferência) com a data de hoje. */
export async function duplicateTransaction(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Não autenticado" };

  const { data: tx, error } = await supabase.from("transactions").select("*").eq("id", id).single();
  if (error || !tx) return { ok: false, error: "Lançamento não encontrado" };

  const today = new Date().toISOString().slice(0, 10);
  const ts = dateToTs(today);

  if (tx.transfer_group_id) {
    const { data: legs } = await supabase
      .from("transactions")
      .select("*")
      .eq("transfer_group_id", tx.transfer_group_id);
    const group = randomUUID();
    const rows = (legs ?? []).map((l) => ({
      user_id: userId,
      type: "transfer" as const,
      amount_cents: l.amount_cents,
      date: ts,
      description: l.description,
      notes: l.notes,
      status: l.status,
      account_id: l.account_id,
      transfer_group_id: group,
    }));
    const { error: insErr } = await supabase.from("transactions").insert(rows);
    if (insErr) return { ok: false, error: insErr.message };
    revalidate();
    return { ok: true };
  }

  const { data: copy, error: insErr } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      type: tx.type,
      amount_cents: tx.amount_cents,
      date: ts,
      description: tx.description,
      notes: tx.notes,
      status: tx.status,
      account_id: tx.account_id,
      category_id: tx.category_id,
    })
    .select("id")
    .single();
  if (insErr || !copy) return { ok: false, error: insErr?.message ?? "Erro ao duplicar" };

  const { data: tags } = await supabase
    .from("transaction_tags")
    .select("tag_id")
    .eq("transaction_id", id);
  if (tags?.length) {
    await supabase
      .from("transaction_tags")
      .insert(tags.map((t) => ({ transaction_id: copy.id, tag_id: t.tag_id })));
  }
  revalidate();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Anexos / Comprovantes
// ---------------------------------------------------------------------------

export type AttachmentRow = {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  storage_key: string;
  created_at: string;
};

/** Lista anexos de um lançamento (chamado do client). */
export async function listAttachments(transactionId: string): Promise<AttachmentRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("attachments")
    .select("id, file_name, mime_type, size_bytes, storage_key, created_at")
    .eq("transaction_id", transactionId)
    .order("created_at", { ascending: true });
  return (data ?? []) as AttachmentRow[];
}

/** Registra um anexo no banco (upload já feito no client via Storage). */
export async function addAttachment(input: AttachmentInput): Promise<ActionResult> {
  const parsed = attachmentInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Não autenticado" };

  const d = parsed.data;
  const { error } = await supabase.from("attachments").insert({
    user_id: userId,
    transaction_id: d.transaction_id,
    file_name: d.file_name,
    mime_type: d.mime_type,
    size_bytes: d.size_bytes,
    storage_key: d.storage_key,
  });
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

/** Remove um anexo do banco (arquivo já removido do Storage no client). */
export async function deleteAttachment(attachmentId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("attachments").delete().eq("id", attachmentId);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
