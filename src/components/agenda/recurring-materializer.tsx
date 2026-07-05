"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { materializeRecurring } from "@/app/(app)/agenda/actions";

/**
 * Ao abrir a Agenda, gera as ocorrências pendentes das recorrências até o
 * horizonte (idempotente). Se algo novo foi criado, atualiza a página.
 */
export function RecurringMaterializer() {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    materializeRecurring().then((res) => {
      if (res.created > 0) router.refresh();
    });
  }, [router]);

  return null;
}
