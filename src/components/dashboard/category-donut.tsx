"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatBRL } from "@/lib/format";

export interface CategorySlice {
  name: string;
  value: number; // centavos
  color: string;
}

export function CategoryDonut({ data }: { data: CategorySlice[] }) {
  const total = data.reduce((acc, d) => acc + d.value, 0);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-[220px] w-[220px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={70} outerRadius={100} paddingAngle={2} strokeWidth={0}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name) => [formatBRL(value), name as string]}
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 13,
                color: "hsl(var(--card-foreground))",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="tabular text-lg font-bold">{formatBRL(total)}</span>
        </div>
      </div>

      <ul className="w-full space-y-1.5">
        {data.map((d) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          return (
            <li key={d.name} className="flex items-center gap-2 text-sm">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="flex-1 truncate">{d.name}</span>
              <span className="tabular text-muted-foreground">{pct}%</span>
              <span className="tabular w-24 text-right font-medium">{formatBRL(d.value)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
