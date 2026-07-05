"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Landmark, TrendingUp, TrendingDown, Scale, Camera, Loader2, Trash2, Wallet, CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/lucide-icon";
import { NetWorthChart } from "@/components/dashboard/lazy-charts";
import { saveSnapshot, deleteSnapshot } from "@/app/(app)/patrimonio/actions";
import { formatBRL, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface AssetItem {
  id: string;
  name: string;
  color: string;
  icon: string;
  cents: number;
  kind: string;
}
export interface LiabilityItem {
  id: string;
  name: string;
  color: string;
  icon: string;
  cents: number;
}
export interface NetWorthPoint {
  label: string;
  value: number;
}
export interface SnapshotItem {
  id: string;
  date: string;
  assetsCents: number;
  liabilitiesCents: number;
  netCents: number;
}

interface Props {
  assetsCents: number;
  liabilitiesCents: number;
  netCents: number;
  investmentsTotal: number;
  assetItems: AssetItem[];
  liabilityItems: LiabilityItem[];
  series: NetWorthPoint[];
  snapshots: SnapshotItem[];
}

export function PatrimonioView({
  assetsCents, liabilitiesCents, netCents, investmentsTotal,
  assetItems, liabilityItems, series, snapshots,
}: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function onSnapshot() {
    setSaving(true);
    await saveSnapshot();
    setSaving(false);
    router.refresh();
  }
  async function onDelete(id: string) {
    setBusyId(id);
    await deleteSnapshot(id);
    setBusyId(null);
    router.refresh();
  }

  const cards = [
    { label: "Ativos", value: assetsCents, icon: TrendingUp, tone: "text-success", hint: `inclui ${formatBRL(investmentsTotal)} em investimentos` },
    { label: "Passivos", value: liabilitiesCents, icon: TrendingDown, tone: "text-destructive", hint: "cartões e dívidas" },
    { label: "Patrimônio líquido", value: netCents, icon: Scale, tone: netCents >= 0 ? "" : "text-destructive", hint: "ativos − passivos" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Patrimônio</h1>
          <p className="mt-1 text-muted-foreground">Ativos, passivos e a evolução do seu patrimônio líquido.</p>
        </div>
        <Button onClick={onSnapshot} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          Registrar snapshot
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => {
          const Ic = c.icon;
          return (
            <Card key={c.label}>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                <Ic className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={cn("tabular text-2xl font-bold", c.tone)}>{formatBRL(c.value)}</div>
                <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evolução do patrimônio · 12 meses</CardTitle>
        </CardHeader>
        <CardContent>
          <NetWorthChart data={series} />
          <p className="mt-2 text-xs text-muted-foreground">
            Estimativa retrocedida do resultado mensal; meses com snapshot registrado usam o valor observado.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2"><Wallet className="h-4 w-4 text-success" /> Ativos</CardTitle>
            <span className="tabular text-sm font-semibold text-success">{formatBRL(assetsCents)}</span>
          </CardHeader>
          <CardContent>
            {assetItems.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum ativo cadastrado.</p>
            ) : (
              <ul className="divide-y">
                {assetItems.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: a.color }}>
                      <Icon name={a.icon} className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.kind}</p>
                    </div>
                    <span className={cn("tabular shrink-0 text-sm font-semibold", a.cents < 0 && "text-destructive")}>{formatBRL(a.cents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-destructive" /> Passivos</CardTitle>
            <span className="tabular text-sm font-semibold text-destructive">{formatBRL(liabilitiesCents)}</span>
          </CardHeader>
          <CardContent>
            {liabilityItems.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma dívida no momento. 🎉</p>
            ) : (
              <ul className="divide-y">
                {liabilityItems.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 py-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: l.color }}>
                      <Icon name={l.icon} className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.name}</p>
                      <p className="text-xs text-muted-foreground">Fatura em aberto</p>
                    </div>
                    <span className="tabular shrink-0 text-sm font-semibold text-destructive">−{formatBRL(l.cents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2"><Landmark className="h-4 w-4 text-muted-foreground" /> Snapshots registrados</CardTitle>
        </CardHeader>
        <CardContent>
          {snapshots.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum snapshot ainda. Registre um para começar a acompanhar a evolução real do patrimônio.
            </p>
          ) : (
            <ul className="divide-y">
              {snapshots.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="w-24 shrink-0 text-muted-foreground">{formatDate(s.date + "T12:00:00")}</span>
                  <span className="tabular hidden text-success sm:inline">{formatBRL(s.assetsCents)}</span>
                  <span className="tabular hidden text-destructive sm:inline">−{formatBRL(s.liabilitiesCents)}</span>
                  <span className={cn("tabular ml-auto font-semibold", s.netCents < 0 && "text-destructive")}>{formatBRL(s.netCents)}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" aria-label="Excluir snapshot" onClick={() => onDelete(s.id)} disabled={busyId === s.id}>
                    {busyId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
