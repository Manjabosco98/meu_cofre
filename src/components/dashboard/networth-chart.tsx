"use client";

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { formatBRL } from "@/lib/format";
import { formatAxisBRL, CHART_COLORS } from "@/lib/chart";

export interface NetWorthPoint {
  label: string;
  value: number; // centavos
}

export function NetWorthChart({ data }: { data: NetWorthPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="nw" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.networth} stopOpacity={0.35} />
            <stop offset="95%" stopColor={CHART_COLORS.networth} stopOpacity={0} />
          </linearGradient>
        </defs>
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
          formatter={(value: number) => [formatBRL(value), "Patrimônio"]}
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 13,
            color: "hsl(var(--card-foreground))",
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={CHART_COLORS.networth}
          strokeWidth={2}
          fill="url(#nw)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
