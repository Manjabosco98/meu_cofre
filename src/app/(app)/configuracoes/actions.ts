"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUserIdFromSession } from "@/lib/supabase/server";
import { firstZodError, type ActionResult } from "@/lib/action-result";
import { profileSettingsSchema, type ProfileSettingsInput } from "@/lib/zod-schemas/settings";

export async function updateProfileSettings(input: ProfileSettingsInput): Promise<ActionResult> {
  const parsed = profileSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const supabase = createClient();
  const userId = await getUserIdFromSession();
  if (!userId) return { ok: false, error: "Não autenticado" };

  const data = parsed.data;
  const { error } = await supabase
    .from("profiles")
    .update({
      name: data.name,
      avatar_url: data.avatar_url || null,
      currency: data.currency,
      timezone: data.timezone,
      theme: data.theme,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/configuracoes");
  revalidatePath("/dashboard");
  return { ok: true };
}
