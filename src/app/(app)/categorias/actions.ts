"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUserIdFromSession } from "@/lib/supabase/server";
import { categorySchema, tagSchema, type CategoryInput, type TagInput } from "@/lib/zod-schemas/category";
import { firstZodError, type ActionResult } from "@/lib/action-result";

function revalidate() {
  revalidatePath("/categorias");
}

const getUserId = getUserIdFromSession;

// ---------- Categorias ----------

export async function createCategory(input: CategoryInput): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Não autenticado" };

  const d = parsed.data;
  const { error } = await supabase.from("categories").insert({
    user_id: userId,
    name: d.name,
    kind: d.kind,
    parent_id: d.parent_id || null,
    color: d.color,
    icon: d.icon,
    is_default: false,
  });
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function updateCategory(id: string, input: CategoryInput): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const supabase = createClient();
  const d = parsed.data;
  const { error } = await supabase
    .from("categories")
    .update({
      name: d.name,
      kind: d.kind,
      parent_id: d.parent_id || null,
      color: d.color,
      icon: d.icon,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

// ---------- Tags ----------

export async function createTag(input: TagInput): Promise<ActionResult> {
  const parsed = tagSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const supabase = createClient();
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Não autenticado" };

  const { error } = await supabase.from("tags").insert({
    user_id: userId,
    name: parsed.data.name,
    color: parsed.data.color,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Já existe uma tag com esse nome" };
    return { ok: false, error: error.message };
  }
  revalidate();
  return { ok: true };
}

export async function updateTag(id: string, input: TagInput): Promise<ActionResult> {
  const parsed = tagSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const supabase = createClient();
  const { error } = await supabase
    .from("tags")
    .update({ name: parsed.data.name, color: parsed.data.color })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Já existe uma tag com esse nome" };
    return { ok: false, error: error.message };
  }
  revalidate();
  return { ok: true };
}

export async function deleteTag(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("tags").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
