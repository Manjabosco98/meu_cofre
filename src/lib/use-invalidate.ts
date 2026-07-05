"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

/**
 * Hook que combina invalidação de queries React Query com revalidação do
 * Router Cache do Next.js. Usar após mutations em Client Components.
 *
 * Substitui o padrão `router.refresh()` por invalidação seletiva:
 * - React Query: invalida só as queries afetadas (stale-while-revalidate)
 * - Router: revalida as rotas do servidor (Server Components re-renderizam)
 *
 * @param queryKeys - Chaves do React Query a invalidar (use queryKeys.* ou queryGroups.*)
 * @param paths - Rotas Next.js a revalidar via revalidatePath (server-side)
 *
 * @example
 * const { invalidateAndRefresh } = useInvalidate();
 * await createTransaction(input);
 * invalidateAndRefresh(
 *   [queryKeys.transactions, queryKeys.dashboard],
 *   ["/lancamentos", "/dashboard"]
 * );
 */
export function useInvalidate() {
  const qc = useQueryClient();
  const router = useRouter();

  const invalidateAndRefresh = useCallback(
    (keys: (string | unknown[])[], paths?: string[]) => {
      for (const key of keys) {
        qc.invalidateQueries({ queryKey: key as readonly unknown[] });
      }
      router.refresh();
    },
    [qc, router],
  );

  return { invalidateAndRefresh, qc };
}
