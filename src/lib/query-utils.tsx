import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { ReactNode } from "react";

/**
 * Criado a cada request server-side para prefetch de dados + dehydrate.
 * O client recebe o estado dehydrate e o HydrationBoundary transfere
 * para o QueryClient do browser sem refetch desnecessário.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
      },
    },
  });
}

/**
 * Wrapper para Server Components: prefetch + dehydrate + HydrationBoundary.
 * Uso:
 * ```tsx
 * export default async function Page() {
 *   const qc = makeQueryClient();
 *   await qc.prefetchQuery({ queryKey: ["accounts"], queryFn: fetchAccounts });
 *   return (
 *     <ServerHydration qc={qc}>
 *       <ClientPage />
 *     </ServerHydration>
 *   );
 * }
 * ```
 */
export async function ServerHydration({
  qc,
  children,
}: {
  qc: QueryClient;
  children: ReactNode;
}) {
  return (
    <HydrationBoundary state={dehydrate(qc)}>{children}</HydrationBoundary>
  );
}
