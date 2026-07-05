"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUserIdFromSession } from "@/lib/supabase/server";
import { computeNetWorthNow } from "@/lib/networth";
import type { ActionResult } from "@/lib/action-result";

function revalidate() {
  revalidatePath("/patrimonio");
  revalidatePath("/dashboard");
}

/** Registra um snapshot do patrimônio com os valores atuais (1 por dia). */
export async function saveSnapshot(): Promise<ActionResult> {
  const supabase = createClient();
  const userId = await getUserIdFromSession();
  if (!userId) return { ok: false, error: "Não autenticado" };

  const { assetsCents, liabilitiesCents } = await computeNetWorthNow(supabase);
  const today = new Date().toISOString().slice(0, 10);

  // Um snapshot por dia: substitui o de hoje, se existir.
  await supabase.from("net_worth_snapshots").delete().eq("date", today);
  const { error } = await supabase.from("net_worth_snapshots").insert({
    user_id: userId,
    date: today,
    assets_cents: assetsCents,
    liabilities_cents: liabilitiesCents,
  });
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function deleteSnapshot(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("net_worth_snapshots").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
