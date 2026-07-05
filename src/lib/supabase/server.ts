import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Cliente Supabase para Server Components / Route Handlers / Server Actions.
 * Lê e escreve a sessão nos cookies. Respeita RLS com a sessão do usuário.
 *
 * Retorno anotado como `SupabaseClient<Database>`: o tipo inferido de
 * `createServerClient` é grande demais e o TS o colapsa para `never` na fronteira
 * da função; o cast alinha com o tipo que resolve as queries corretamente.
 */
export function createClient(): SupabaseClient<Database> {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado de um Server Component: ignorável — o middleware renova a sessão.
          }
        },
      },
    },
  ) as unknown as SupabaseClient<Database>;
}

/**
 * Obtém o user ID a partir da sessão (JWT local, sem chamada à rede do Auth).
 * Seguro porque o middleware já validou a sessão via getUser() nesta mesma request.
 * Lança se não houver sessão (usuário não autenticado).
 */
export async function getUserIdFromSession(): Promise<string> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Não autenticado");
  return session.user.id;
}
