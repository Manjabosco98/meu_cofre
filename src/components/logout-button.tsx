"use client";

import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full justify-start gap-2">
      <LogOut className="h-4 w-4" />
      Sair
    </Button>
  );
}
