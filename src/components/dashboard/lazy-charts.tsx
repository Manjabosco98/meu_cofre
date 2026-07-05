"use client";

// Wrappers dinâmicos dos gráficos (Recharts). ssr:false + code-splitting: o Recharts
// (~pesado) sai do First Load JS e só é baixado quando a tela que usa o gráfico monta.
// Definido num módulo "use client" para permitir ssr:false mesmo quando o consumidor
// é um Server Component (ex.: dashboard/page.tsx).
import dynamic from "next/dynamic";

const ChartSkeleton = () => <div className="h-[280px] w-full animate-pulse rounded-md bg-muted" />;

export const IncomeExpenseChart = dynamic(
  () => import("./income-expense-chart").then((m) => m.IncomeExpenseChart),
  { ssr: false, loading: ChartSkeleton },
);

export const NetWorthChart = dynamic(
  () => import("./networth-chart").then((m) => m.NetWorthChart),
  { ssr: false, loading: ChartSkeleton },
);

export const CategoryDonut = dynamic(
  () => import("./category-donut").then((m) => m.CategoryDonut),
  { ssr: false, loading: ChartSkeleton },
);
