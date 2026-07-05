import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsView, type ProfileSettingsData } from "@/components/settings/settings-view";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const { user } = session;

  const { data: profile } = await supabase
    .from("profiles")
    .select("name,avatar_url,currency,timezone,theme")
    .eq("id", user.id)
    .single();

  const fallback: ProfileSettingsData = {
    name: user.email?.split("@")[0] ?? "Usuário",
    avatar_url: null,
    currency: "BRL",
    timezone: "America/Sao_Paulo",
    theme: "system",
  };

  return (
    <SettingsView
      profile={(profile ?? fallback) as ProfileSettingsData}
      email={user.email ?? ""}
    />
  );
}
