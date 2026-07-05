import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

/**
 * Layout do app autenticado.
 * O middleware já validou o user via getUser(); aqui usamos getSession() (leitura
 * local do JWT, sem chamada à rede) para obter email/id apenas para UI. RLS
 * continua protegendo todos os dados no banco.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  const { user } = session;

  const { data: profile } = await supabase
    .from("profiles")
    .select("name,theme")
    .eq("id", user.id)
    .single();

  const name = profile?.name || user.email?.split("@")[0] || "Usuario";

  return (
    <AppShell userName={name} userEmail={user.email ?? ""}>
      {children}
    </AppShell>
  );
}
