"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUserIdFromSession } from "@/lib/supabase/server";
import { accountSchema, type AccountInput } from "@/lib/zod-schemas/account";
import { ACCOUNT_TYPES } from "@/lib/account-meta";
import { firstZodError, type ActionResult } from "@/lib/action-result";

function revalidate() {
  revalidatePath("/contas");
  revalidatePath("/dashboard");
}

export async function createAccount(input: AccountInput): Promise<ActionResult> {
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const supabase = createClient();
  const userId = await getUserIdFromSession();
  if (!userId) return { ok: false, error: "Não autenticado" };

  const d = parsed.data;
  const { error } = await supabase.from("accounts").insert({
    user_id: userId,
    name: d.name,
    type: d.type,
    institution: d.institution || null,
    titularidade: d.titularidade,
    agencia: d.agencia || null,
    numero_conta: d.numero_conta || null,
    initial_balance_cents: d.initial_balance_cents,
    color: d.color,
    icon: ACCOUNT_TYPES[d.type].icon,
  });
  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true };
}

export async function updateAccount(id: string, input: AccountInput): Promise<ActionResult> {
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const supabase = createClient();
  const d = parsed.data;
  const { error } = await supabase
    .from("accounts")
    .update({
      name: d.name,
      type: d.type,
      institution: d.institution || null,
      titularidade: d.titularidade,
      agencia: d.agencia || null,
      numero_conta: d.numero_conta || null,
      initial_balance_cents: d.initial_balance_cents,
      color: d.color,
      icon: ACCOUNT_TYPES[d.type].icon,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true };
}

export async function setAccountArchived(id: string, archived: boolean): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("accounts").update({ archived }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
