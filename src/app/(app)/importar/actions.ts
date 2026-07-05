"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUserIdFromSession } from "@/lib/supabase/server";
import { firstZodError, type ActionResult } from "@/lib/action-result";
import { importConfirmSchema, importPreviewSchema, type ImportPreviewInput } from "@/lib/zod-schemas/import";
import { importFingerprint, normalizeImportDescription } from "@/lib/import-parser";
import { computeInvoicePeriod } from "@/lib/card-invoice";

export interface ImportPreviewRow {
  clientId: string;
  date: string;
  description: string;
  amountCents: number;
  type: "income" | "expense";
  externalId: string | null;
  fingerprint: string;
  duplicate: boolean;
  duplicateReason: string | null;
  possibleMatch: {
    id: string;
    description: string;
    date: string;
    status: "pending" | "cleared";
  } | null;
}

export type ImportPreviewResult =
  | { ok: true; rows: ImportPreviewRow[]; duplicateCount: number; matchCount: number }
  | { ok: false; error: string };

function dateToTs(date: string) {
  return `${date}T12:00:00.000Z`;
}

function addDays(date: string, days: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dateDistance(a: string, b: string) {
  const da = Date.parse(a.slice(0, 10) + "T12:00:00Z");
  const db = Date.parse(b.slice(0, 10) + "T12:00:00Z");
  return Math.abs(da - db) / 86400000;
}

function similarity(a: string, b: string) {
  const aa = new Set(normalizeImportDescription(a).split(" ").filter(Boolean));
  const bb = new Set(normalizeImportDescription(b).split(" ").filter(Boolean));
  if (!aa.size || !bb.size) return 0;
  let intersection = 0;
  for (const word of aa) if (bb.has(word)) intersection++;
  return intersection / Math.max(aa.size, bb.size);
}

const getUserId = getUserIdFromSession;

/** Find or create the correct invoice for a card purchase date. */
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

async function buildPreview(input: ImportPreviewInput): Promise<ImportPreviewResult> {
  const supabase = createClient();
  const minDate = input.rows.reduce((min, row) => (row.date < min ? row.date : min), input.rows[0].date);
  const maxDate = input.rows.reduce((max, row) => (row.date > max ? row.date : max), input.rows[0].date);

  // When importing to a card, look up existing transactions on the card's account
  let targetAccountId = input.accountId;
  if (input.cardId) {
    const { data: card } = await supabase
      .from("credit_cards")
      .select("account_id")
      .eq("id", input.cardId)
      .single();
    if (card) targetAccountId = card.account_id;
  }

  const { data: existing, error } = await supabase
    .from("transactions")
    .select("id,type,amount_cents,date,description,status,fingerprint,external_id")
    .eq("account_id", targetAccountId)
    .gte("date", `${addDays(minDate, -3)}T00:00:00Z`)
    .lte("date", `${addDays(maxDate, 3)}T23:59:59Z`);
  if (error) return { ok: false, error: error.message };

  const rows: ImportPreviewRow[] = input.rows.map((row) => {
    const fingerprint = importFingerprint(targetAccountId, row, input.cardId ?? undefined);
    const exact = (existing ?? []).find((tx) => {
      const sameFingerprint = tx.fingerprint && tx.fingerprint === fingerprint;
      const sameExternal = row.externalId && tx.external_id && row.externalId === tx.external_id;
      const sameNatural =
        tx.type === row.type &&
        Math.abs(tx.amount_cents) === row.amountCents &&
        tx.date.slice(0, 10) === row.date &&
        normalizeImportDescription(tx.description) === normalizeImportDescription(row.description);
      // For card imports, skip sameExternal alone (FITID is reused by Nubank)
      if (input.cardId) return sameFingerprint || sameNatural;
      return sameFingerprint || sameExternal || sameNatural;
    });

    const possible = exact
      ? null
      : (existing ?? []).find((tx) => (
          tx.type === row.type &&
          Math.abs(tx.amount_cents) === row.amountCents &&
          dateDistance(tx.date, row.date) <= 2 &&
          similarity(tx.description, row.description) >= 0.25
        ));

    return {
      ...row,
      fingerprint,
      duplicate: !!exact,
      duplicateReason: exact?.fingerprint === fingerprint
        ? "Mesmo fingerprint"
        : exact
          ? "Mesmo lançamento"
          : null,
      possibleMatch: possible
        ? {
            id: possible.id,
            description: possible.description,
            date: possible.date,
            status: possible.status,
          }
        : null,
    };
  });

  return {
    ok: true,
    rows,
    duplicateCount: rows.filter((row) => row.duplicate).length,
    matchCount: rows.filter((row) => row.possibleMatch).length,
  };
}

export async function previewImport(input: ImportPreviewInput): Promise<ImportPreviewResult> {
  const parsed = importPreviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
  return buildPreview(parsed.data);
}

export async function confirmImport(input: unknown): Promise<ActionResult & { imported?: number; skipped?: number }> {
  const parsed = importConfirmSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Não autenticado" };

  const preview = await buildPreview(parsed.data);
  if (!preview.ok) return preview;

  const selected = new Set(parsed.data.selectedClientIds);
  const selectedRows = preview.rows.filter((row) => selected.has(row.clientId));
  const rowsToInsert = selectedRows.filter((row) => !row.duplicate);

  const supabase = createClient();

  // Resolve card data if importing to a card
  let cardData: { id: string; account_id: string; closing_day: number; due_day: number } | null = null;
  if (parsed.data.cardId) {
    const { data } = await supabase
      .from("credit_cards")
      .select("id, account_id, closing_day, due_day")
      .eq("id", parsed.data.cardId)
      .single();
    cardData = data;
  }

  const targetAccountId = cardData?.account_id ?? parsed.data.accountId;

  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({
      user_id: userId,
      file_name: parsed.data.fileName,
      source: parsed.data.source,
      imported_count: rowsToInsert.length,
      duplicate_count: preview.duplicateCount,
    })
    .select("id")
    .single();
  if (batchError || !batch) return { ok: false, error: batchError?.message ?? "Erro ao criar lote" };

  if (rowsToInsert.length) {
    if (cardData) {
      // Card import: insert each transaction linked to the correct invoice
      for (const row of rowsToInsert) {
        const invoiceId = await ensureInvoice(
          supabase, userId, cardData.id, cardData.closing_day, cardData.due_day, row.date,
        );
        const { error } = await supabase.from("transactions").insert({
          user_id: userId,
          account_id: targetAccountId,
          type: row.type,
          amount_cents: row.amountCents,
          date: dateToTs(row.date),
          description: row.description,
          notes: `Importado de ${parsed.data.fileName}`,
          status: "cleared" as const,
          category_id: null,
          external_id: row.externalId,
          fingerprint: row.fingerprint,
          import_batch_id: batch.id,
          reconciled: !!row.possibleMatch,
          invoice_id: invoiceId,
        });
        if (error) return { ok: false, error: error.message };
      }
    } else {
      // Regular account import: bulk insert
      const { error } = await supabase.from("transactions").insert(
        rowsToInsert.map((row) => ({
          user_id: userId,
          account_id: targetAccountId,
          type: row.type,
          amount_cents: row.amountCents,
          date: dateToTs(row.date),
          description: row.description,
          notes: `Importado de ${parsed.data.fileName}`,
          status: "cleared" as const,
          category_id: null,
          external_id: row.externalId,
          fingerprint: row.fingerprint,
          import_batch_id: batch.id,
          reconciled: !!row.possibleMatch,
        })),
      );
      if (error) return { ok: false, error: error.message };
    }
  }

  revalidatePath("/importar");
  revalidatePath("/lancamentos");
  revalidatePath("/dashboard");
  revalidatePath("/contas");
  revalidatePath("/cartoes");
  revalidatePath("/relatorios");
  return { ok: true, imported: rowsToInsert.length, skipped: selectedRows.length - rowsToInsert.length };
}

export async function saveAcctIdMapping(acctId: string, cardId: string): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Não autenticado" };
  const supabase = createClient();
  const { error } = await supabase
    .from("ofx_acctid_map")
    .upsert({ user_id: userId, acctid: acctId, card_id: cardId }, { onConflict: "user_id,acctid" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function lookupCardByAcctId(acctId: string): Promise<string | null> {
  const userId = await getUserId();
  if (!userId) return null;
  const supabase = createClient();
  const { data } = await supabase
    .from("ofx_acctid_map")
    .select("card_id")
    .eq("user_id", userId)
    .eq("acctid", acctId)
    .maybeSingle();
  return data?.card_id ?? null;
}
