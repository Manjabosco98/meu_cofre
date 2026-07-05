"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Cliente Supabase para uso no browser (Client Components). Usa a anon/publishable key + RLS.
 *
 * O retorno é anotado como `SupabaseClient<Database>` porque o tipo inferido de
 * `createBrowserClient` é grande demais (20 tabelas) e o TS o colapsa para `never`
 * ao cruzar a fronteira da função. O cast alinha com o tipo que resolve corretamente.
 */
export function createClient(): SupabaseClient<Database> {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  ) as unknown as SupabaseClient<Database>;
}
