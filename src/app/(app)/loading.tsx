// Skeleton exibido instantaneamente ao navegar entre telas do app (Suspense do
// App Router), enquanto o Server Component busca os dados. Genérico o suficiente
// para servir a qualquer página (título + cartões de resumo + bloco de conteúdo).
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-48 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-64 animate-pulse rounded bg-muted/70" />
        </div>
        <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-4">
            <div className="h-4 w-24 animate-pulse rounded bg-muted/70" />
            <div className="mt-3 h-7 w-28 animate-pulse rounded-md bg-muted" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border p-4">
          <div className="h-5 w-40 animate-pulse rounded bg-muted/70" />
          <div className="mt-4 h-[240px] animate-pulse rounded-md bg-muted" />
        </div>
        <div className="rounded-xl border p-4">
          <div className="h-5 w-40 animate-pulse rounded bg-muted/70" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-muted/60" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
