"use client";

import dynamic from "next/dynamic";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Wallet, TrendingDown, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
// Recharts lazy: só baixa quando o gráfico monta (fora do First Load JS).
const CashflowChart = dynamic(
  () => import("@/components/cashflow/cashflow-chart").then((m) => m.CashflowChart),
  { ssr: false, loading: () => <div className="h-[280px] w-full animate-pulse rounded-md bg-muted" /> },
);
import { formatBRL } from "@/lib/format";
import { GRANULARITY_LABELS, type Granularity } from "@/lib/cashflow";
import { cn } from "@/lib/utils";

export interface FlowRow {
  key: string;
  label: string;
  entradas: number;
  saidas: number;
  resultado: number;
  saldo: number;
  isFuture: boolean;
  isCurrent: boolean;
}

interface Props {
  granularity: Granularity;
  rows: FlowRow[];
  saldoAtual: number;
  minProjected: { value: number; label: string } | null;
  hasNegative: boolean;
}

export function CashflowView({ granularity, rows, saldoAtual, minProjected, hasNegative }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setGran(g: Granularity) {
    const next = new URLSearchParams(params.toString());
    next.set("g", g);
    router.push(`${pathname}?${next.toString()}`);
  }

  const chartData = rows.map((r) => ({ label: r.label, saldo: r.saldo }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fluxo de caixa</h1>
          <p className="mt-1 text-muted-foreground">Saldo acumulado e projeção com os lançamentos previstos.</p>
        </div>
        <div className="inline-flex rounded-lg border bg-muted/40 p-1">
          {(["day", "week", "month"] as Granularity[]).map((g) => (
            <button
              key={g}
              onClick={() => setGran(g)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition",
                granularity === g ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {GRANULARITY_LABELS[g]}
            </button>
          ))}
        </div>
      </div>

      {/* Resumo */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Saldo atual</p>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className={cn("tabular text-xl font-bold", saldoAtual < 0 && "text-destructive")}>{formatBRL(saldoAtual)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Menor saldo projetado</p>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className={cn("tabular text-xl font-bold", (minProjected?.value ?? 0) < 0 && "text-destructive")}>
            {minProjected ? formatBRL(minProjected.value) : "—"}
          </p>
          {minProjected && <p className="mt-1 text-xs text-muted-foreground">em {minProjected.label}</p>}
        </CardContent></Card>
        <Card><CardContent className="flex flex-col justify-center p-4">
          {hasNegative ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">Saldo negativo projetado no período</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">Sem saldo negativo projetado</p>
            </div>
          )}
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Saldo acumulado</CardTitle></CardHeader>
        <CardContent><CashflowChart data={chartData} /></CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader><CardTitle>Detalhamento</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Período</th>
                  <th className="px-4 py-2 text-right font-medium">Entradas</th>
                  <th className="px-4 py-2 text-right font-medium">Saídas</th>
                  <th className="px-4 py-2 text-right font-medium">Resultado</th>
                  <th className="px-4 py-2 text-right font-medium">Saldo acumulado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className={cn("border-b last:border-0", r.isCurrent && "bg-primary/5")}>
                    <td className="whitespace-nowrap px-4 py-2">
                      <span className="font-medium">{r.label}</span>
                      {r.isCurrent && <Badge className="ml-2 border-primary/40 bg-primary/10 text-primary">agora</Badge>}
                      {r.isFuture && <span className="ml-2 text-xs text-muted-foreground">projeção</span>}
                    </td>
                    <td className="tabular px-4 py-2 text-right text-success">{r.entradas ? formatBRL(r.entradas) : "—"}</td>
                    <td className="tabular px-4 py-2 text-right text-destructive">{r.saidas ? formatBRL(r.saidas) : "—"}</td>
                    <td className={cn("tabular px-4 py-2 text-right", r.resultado < 0 ? "text-destructive" : r.resultado > 0 ? "text-success" : "text-muted-foreground")}>
                      {r.resultado ? `${r.resultado > 0 ? "+" : "−"}${formatBRL(Math.abs(r.resultado))}` : "—"}
                    </td>
                    <td className={cn("tabular px-4 py-2 text-right font-semibold", r.saldo < 0 && "text-destructive")}>
                      {formatBRL(r.saldo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
