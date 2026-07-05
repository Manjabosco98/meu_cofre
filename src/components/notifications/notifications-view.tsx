"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Bell, CheckCheck, CheckCircle2, Loader2, Target, Trash2, Undo2, WalletCards,
} from "lucide-react";
import {
  deleteNotification,
  generateNotifications,
  markAllNotificationsRead,
  setNotificationRead,
} from "@/app/(app)/notificacoes/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type NotificationType = "bill_due" | "budget_exceeded" | "goal_achieved" | "general";

export interface NotificationRow {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  related_id: string | null;
  read_at: string | null;
  created_at: string;
}

interface Props {
  notifications: NotificationRow[];
}

function meta(type: NotificationType) {
  if (type === "budget_exceeded") {
    return { label: "Orçamento", icon: AlertTriangle, tone: "text-destructive", bg: "bg-destructive/10" };
  }
  if (type === "goal_achieved") {
    return { label: "Meta", icon: Target, tone: "text-success", bg: "bg-success/10" };
  }
  if (type === "bill_due") {
    return { label: "Vencimento", icon: WalletCards, tone: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" };
  }
  return { label: "Geral", icon: Bell, tone: "text-primary", bg: "bg-primary/10" };
}

export function NotificationsView({ notifications }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "unread" | "read">("unread");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let alive = true;
    setGenerating(true);
    generateNotifications().then((result) => {
      if (!alive) return;
      setGenerating(false);
      if (result.ok && result.created > 0) router.refresh();
    });
    return () => {
      alive = false;
    };
  }, [router]);

  const unread = notifications.filter((n) => !n.read_at).length;
  const filtered = useMemo(() => {
    if (filter === "unread") return notifications.filter((n) => !n.read_at);
    if (filter === "read") return notifications.filter((n) => n.read_at);
    return notifications;
  }, [filter, notifications]);

  async function toggleRead(row: NotificationRow) {
    setBusyId(row.id);
    await setNotificationRead(row.id, !row.read_at);
    setBusyId(null);
    router.refresh();
  }

  async function remove(row: NotificationRow) {
    setBusyId(row.id);
    await deleteNotification(row.id);
    setBusyId(null);
    router.refresh();
  }

  async function markAllRead() {
    setBusyId("all");
    await markAllNotificationsRead();
    setBusyId(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notificações</h1>
          <p className="mt-1 text-muted-foreground">Alertas de vencimentos, orçamentos e metas.</p>
        </div>
        <Button variant="outline" onClick={markAllRead} disabled={busyId === "all" || unread === 0} className="gap-2">
          {busyId === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
          Marcar todas como lidas
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Não lidas" value={unread} tone={unread > 0 ? "text-primary" : ""} />
        <SummaryCard label="Total" value={notifications.length} />
        <SummaryCard label="Atualização" value={generating ? "..." : "ok"} />
      </div>

      <div className="inline-flex rounded-lg border bg-muted/40 p-1">
        {[
          ["unread", "Não lidas"],
          ["all", "Todas"],
          ["read", "Lidas"],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value as typeof filter)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition",
              filter === value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Central de alertas</CardTitle></CardHeader>
        <CardContent className="p-0">
          {filtered.length ? (
            <ul className="divide-y">
              {filtered.map((row) => {
                const m = meta(row.type);
                const Icon = m.icon;
                return (
                  <li key={row.id} className={cn("flex items-start gap-3 p-4", !row.read_at && "bg-primary/5")}>
                    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md", m.bg, m.tone)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{row.title}</p>
                        <Badge className="border-muted-foreground/30 bg-muted text-muted-foreground">{m.label}</Badge>
                        {!row.read_at && <Badge className="border-primary/30 bg-primary/10 text-primary">Nova</Badge>}
                      </div>
                      {row.body && <p className="mt-1 text-sm text-muted-foreground">{row.body}</p>}
                      <p className="mt-1 text-xs text-muted-foreground">{formatDate(row.created_at)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {busyId === row.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleRead(row)}
                        aria-label={row.read_at ? "Marcar como não lida" : "Marcar como lida"}
                      >
                        {row.read_at ? <Undo2 className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4 text-success" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => remove(row)}
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma notificação para este filtro.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={cn("tabular text-xl font-bold", tone)}>{value}</p>
      </CardContent>
    </Card>
  );
}
