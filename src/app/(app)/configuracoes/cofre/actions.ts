"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUserIdFromSession } from "@/lib/supabase/server";
import {
  vaultItemSchema, masterSetupSchema, masterChangeSchema, secretAccessSchema,
  type VaultItemInput, type MasterSetupInput, type MasterChangeInput, type SecretAccessInput,
} from "@/lib/zod-schemas/vault";
import { firstZodError, type ActionResult } from "@/lib/action-result";
import type { Database, Json } from "@/lib/database.types";

type VaultAction = Database["public"]["Enums"]["vault_audit_action"];

function revalidate() {
  revalidatePath("/configuracoes/cofre");
}

const getUserId = getUserIdFromSession;

/** Registra uma ação no histórico do cofre — NUNCA inclui valores de segredos. */
async function logAudit(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  action: VaultAction,
  vaultItemId: string | null,
  metadata: Record<string, unknown> = {},
) {
  await supabase.from("vault_audit_logs").insert({
    user_id: userId,
    vault_item_id: vaultItemId,
    action,
    metadata: metadata as Json,
  });
}

/** "" -> null (campos opcionais). */
function nn(v: string | null | undefined): string | null {
  return v && v.length ? v : null;
}

function itemRow(userId: string, d: VaultItemInput) {
  return {
    user_id: userId,
    name: d.name,
    type: d.type,
    url: nn(d.url),
    username: nn(d.username),
    encrypted_password: nn(d.encrypted_password),
    encrypted_notes: nn(d.encrypted_notes),
    encrypted_token: nn(d.encrypted_token),
    encrypted_api_key: nn(d.encrypted_api_key),
    category: nn(d.category),
    status: d.status,
    has_2fa: d.has_2fa,
    recovery_email: nn(d.recovery_email),
    recovery_phone: nn(d.recovery_phone),
    expires_at: nn(d.expires_at),
    favorite: d.favorite,
    tags: d.tags,
  };
}

// ---------------------------------------------------------------------------
// Senha-mestra
// ---------------------------------------------------------------------------

export async function setupMasterPassword(input: MasterSetupInput): Promise<ActionResult> {
  const parsed = masterSetupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Não autenticado" };

  const { data: existing } = await supabase
    .from("vault_settings").select("id").eq("user_id", userId).maybeSingle();
  if (existing) return { ok: false, error: "O cofre já possui senha-mestra." };

  const { error } = await supabase.from("vault_settings").insert({
    user_id: userId,
    salt: parsed.data.salt,
    iterations: parsed.data.iterations,
    verifier: parsed.data.verifier,
  });
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

/** Troca a senha-mestra: novo salt/verifier + re-cifra todos os itens (feito no cliente). */
export async function changeMasterPassword(input: MasterChangeInput): Promise<ActionResult> {
  const parsed = masterChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Não autenticado" };
  const d = parsed.data;

  const { error: sErr } = await supabase
    .from("vault_settings")
    .update({ salt: d.salt, iterations: d.iterations, verifier: d.verifier, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (sErr) return { ok: false, error: sErr.message };

  for (const it of d.items) {
    const { error } = await supabase
      .from("vault_items")
      .update({
        encrypted_password: nn(it.encrypted_password),
        encrypted_notes: nn(it.encrypted_notes),
        encrypted_token: nn(it.encrypted_token),
        encrypted_api_key: nn(it.encrypted_api_key),
        updated_at: new Date().toISOString(),
      })
      .eq("id", it.id)
      .eq("user_id", userId);
    if (error) return { ok: false, error: error.message };
  }

  await logAudit(supabase, userId, "master_password_changed", null, { items: d.items.length });
  revalidate();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// CRUD de acessos
// ---------------------------------------------------------------------------

export async function createVaultItem(input: VaultItemInput): Promise<ActionResult> {
  const parsed = vaultItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Não autenticado" };

  const { data, error } = await supabase
    .from("vault_items")
    .insert(itemRow(userId, parsed.data))
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Erro ao salvar" };

  await logAudit(supabase, userId, "created", data.id, { name: parsed.data.name });
  revalidate();
  return { ok: true };
}

export async function updateVaultItem(id: string, input: VaultItemInput): Promise<ActionResult> {
  const parsed = vaultItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Não autenticado" };

  const { error } = await supabase
    .from("vault_items")
    .update({ ...itemRow(userId, parsed.data), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  await logAudit(supabase, userId, "updated", id, { name: parsed.data.name });
  revalidate();
  return { ok: true };
}

export async function deleteVaultItem(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Não autenticado" };

  // Log antes de excluir (FK ON DELETE SET NULL preserva o histórico).
  await logAudit(supabase, userId, "deleted", id, {});
  const { error } = await supabase.from("vault_items").delete().eq("id", id).eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function toggleVaultFavorite(id: string, favorite: boolean): Promise<ActionResult> {
  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Não autenticado" };
  const { error } = await supabase
    .from("vault_items")
    .update({ favorite, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

/** Registra visualização/cópia de segredo (sem o valor). */
export async function logSecretAccess(input: SecretAccessInput): Promise<ActionResult> {
  const parsed = secretAccessSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Não autenticado" };

  await logAudit(supabase, userId, parsed.data.action, parsed.data.id, {
    field: parsed.data.field ?? "password",
  });
  return { ok: true };
}
