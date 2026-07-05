"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil, Pause, Play, Trash2, Loader2, RefreshCw, CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { formatBRL, formatDate } from "@/lib/format";
import { FREQUENCY_LABELS, describeCadence, type Frequency } from "@/lib/recurrence";
import { cn } from "@/lib/utils";
import { toggleSubscriptionStatus, deleteSubscription } from "@/app/(app)/cartoes/actions";

export interface SubscriptionRow {
  id: string;
  description: string;
  amountCents: number;
  frequency: Frequency;
  interval: number;
  startDate: string;
  endDate: string | null;
  nextBillingDate: string;
  status: "active" | "paused" | "cancelled";
  categoryName: string | null;
  categoryColor: string | null;
  cardName: string;
  cardColor: string;
}

const STATUS_META: Record<string, { label: string; style: string }> = {
  active: { label: "Ativa", style: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  paused: { label: "Pausada", style: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  cancelled: { label: "Cancelada", style: "border-muted bg-muted/50 text-muted-foreground" },
};

interface Props {
  subscriptions: SubscriptionRow[];
}

export function SubscriptionsView({ subscriptions }: Props) {
  const router = useRouter();
  const [toDelete, setToDelete] = useState<SubscriptionRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "paused" | "cancelled">("all");

  const filtered = filter === "all" ? subscriptions : subscriptions.filter((s) => s.status === filter);

  async function toggleStatus(sub: SubscriptionRow) {
    setBusyId(sub.id);
    const newStatus = sub.status === "active" ? "paused" : "active";
    await toggleSubscriptionStatus(sub.id, newStatus);
    setBusyId(null);
    router.refresh();
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setBusyId(toDelete.id);
    await deleteSubscription(toDelete.id);
    setBusyId(null);
    setToDelete(null);
    router.refresh();
  }

  if (subscriptions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <RefreshCw className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium">Nenhuma assinatura cadastrada</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Crie uma assinatura recorrente no modal &quot;Nova compra&quot;.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex gap-1.5">
        {(["all", "active", "paused", "cancelled"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm font-medium transition",
              filter === f
                ? "border-primary bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            {f === "all" ? "Todas" : STATUS_META[f].label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {filtered.map((sub) => (
          <div
            key={sub.id}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-3 sm:px-4",
              sub.status === "cancelled" && "opacity-60",
            )}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
              style={{ backgroundColor: sub.cardColor }}
            >
              <CreditCard className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium">{sub.description}</p>
                <Badge className={STATUS_META[sub.status].style}>
                  {STATUS_META[sub.status].label}
                </Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {sub.cardName} · {describeCadence(sub.frequency, sub.interval)}
                {sub.categoryName && (
                  <span style={{ color: sub.categoryColor ?? undefined }}> · {sub.categoryName}</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Próxima cobrança: {formatDate(sub.nextBillingDate)}
                {sub.endDate && ` · Até ${formatDate(sub.endDate)}`}
              </p>
            </div>

            <p className="tabular shrink-0 font-semibold">{formatBRL(sub.amountCents)}</p>

            <div className="flex shrink-0 items-center gap-0.5">
              {busyId === sub.id ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <>
                  {sub.status !== "cancelled" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => toggleStatus(sub)}
                      aria-label={sub.status === "active" ? "Pausar" : "Reativar"}
                      title={sub.status === "active" ? "Pausar" : "Reativar"}
                    >
                      {sub.status === "active"
                        ? <Pause className="h-4 w-4" />
                        : <Play className="h-4 w-4 text-success" />}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setToDelete(sub)}
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Dialog de exclusão */}
      <Dialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Excluir assinatura"
      >
        <p className="mb-4 text-sm">
          Excluir <strong>{toDelete?.description}</strong>? As cobranças já geradas nas faturas serão preservadas.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setToDelete(null)}>Cancelar</Button>
          <Button variant="destructive" onClick={confirmDelete} disabled={busyId === toDelete?.id}>
            {busyId === toDelete?.id && <Loader2 className="h-4 w-4 animate-spin" />}
            Excluir
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
