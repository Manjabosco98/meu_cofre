"use client";

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import { formatBRL } from "@/lib/format";
import { formatAxisBRL, CHART_COLORS } from "@/lib/chart";

export interface FlowPoint {
  label: string;
  saldo: number; // centavos
}

export function CashflowChart({ data }: { data: FlowPoint[] }) {
  const values = data.map((d) => d.saldo);
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  // Ponto (0–1) onde o zero cai no gradiente vertical.
  const offset = max === min ? 1 : max / (max - min);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="cf-stroke" x1="0" y1="0" x2="0" y2="1">
            <stop offset={offset} stopColor={CHART_COLORS.income} />
            <stop offset={offset} stopColor={CHART_COLORS.expense} />
          </linearGradient>
          <linearGradient id="cf-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset={0} stopColor={CHART_COLORS.income} stopOpacity={0.3} />
            <stop offset={offset} stopColor={CHART_COLORS.income} stopOpacity={0.05} />
            <stop offset={offset} stopColor={CHART_COLORS.expense} stopOpacity={0.05} />
            <stop offset={1} stopColor={CHART_COLORS.expense} stopOpacity={0.3} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART_COLORS.axis }} tickLine={false} axisLine={false} minTickGap={16} />
        <YAxis tickFormatter={(v) => formatAxisBRL(v as number)} tick={{ fontSize: 12, fill: CHART_COLORS.axis }} tickLine={false} axisLine={false} width={64} />
        <Tooltip
          formatter={(value: number) => [formatBRL(value), "Saldo"]}
          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 13, color: "hsl(var(--card-foreground))" }}
        />
        <ReferenceLine y={0} stroke={CHART_COLORS.axis} strokeDasharray="4 4" />
        <Area type="monotone" dataKey="saldo" stroke="url(#cf-stroke)" strokeWidth={2} fill="url(#cf-fill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
