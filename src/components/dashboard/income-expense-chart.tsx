"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { formatBRL } from "@/lib/format";
import { formatAxisBRL, CHART_COLORS } from "@/lib/chart";

export interface MonthPoint {
  label: string;
  income: number; // centavos
  expense: number; // centavos
}

export function IncomeExpenseChart({ data }: { data: MonthPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: CHART_COLORS.axis }} tickLine={false} axisLine={false} />
        <YAxis
          tickFormatter={(v) => formatAxisBRL(v as number)}
          tick={{ fontSize: 12, fill: CHART_COLORS.axis }}
          tickLine={false}
          axisLine={false}
          width={64}
        />
        <Tooltip
          formatter={(value: number, name) => [formatBRL(value), name === "income" ? "Receitas" : "Despesas"]}
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 13,
            color: "hsl(var(--card-foreground))",
          }}
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
        />
        <Legend
          formatter={(v) => (v === "income" ? "Receitas" : "Despesas")}
          wrapperStyle={{ fontSize: 13 }}
        />
        <Bar dataKey="income" fill={CHART_COLORS.income} radius={[4, 4, 0, 0]} maxBarSize={40} />
        <Bar dataKey="expense" fill={CHART_COLORS.expense} radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}
