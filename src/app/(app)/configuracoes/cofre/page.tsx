import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VaultView } from "@/components/vault/vault-view";
import type { VaultItem, VaultConfig, VaultAuditEntry } from "@/components/vault/types";

export const dynamic = "force-dynamic";

export default async function CofrePage() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const { user } = session;

  const [{ data: settings }, { data: items }, { data: logs }] = await Promise.all([
    supabase.from("vault_settings").select("salt,iterations,verifier").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("vault_items")
      .select(
        "id,name,type,url,username,encrypted_password,encrypted_notes,encrypted_token,encrypted_api_key," +
          "category,status,has_2fa,recovery_email,recovery_phone,expires_at,favorite,tags,created_at,updated_at",
      )
      .order("favorite", { ascending: false })
      .order("name", { ascending: true }),
    supabase
      .from("vault_audit_logs")
      .select("id,action,metadata,created_at")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const config: VaultConfig | null = settings
    ? { salt: settings.salt, iterations: settings.iterations, verifier: settings.verifier }
    : null;

  return (
    <VaultView
      config={config}
      items={(items ?? []) as unknown as VaultItem[]}
      logs={(logs ?? []) as unknown as VaultAuditEntry[]}
    />
  );
}
