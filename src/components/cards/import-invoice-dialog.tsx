"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileUp, Loader2, SearchCheck, Upload } from "lucide-react";
import { previewImport, confirmImport, saveAcctIdMapping, type ImportPreviewRow } from "@/app/(app)/importar/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatBRL, formatDate } from "@/lib/format";
import { parseImportFileFull, decodeOfxCharset, type ImportedDraft } from "@/lib/import-parser";
import { cn } from "@/lib/utils";

export interface CardOption {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  cards: CardOption[];
  defaultCardId?: string;
}

export function ImportInvoiceDialog({ open, onClose, cards, defaultCardId }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [cardId, setCardId] = useState(defaultCardId ?? cards[0]?.id ?? "");
  const [fileName, setFileName] = useState("");
  const [drafts, setDrafts] = useState<ImportedDraft[]>([]);
  const [ofxAcctId, setOfxAcctId] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"upload" | "preview">("upload");
  const [dragOver, setDragOver] = useState(false);

  const selectedRows = useMemo(
    () => previewRows.filter((row) => selected.has(row.clientId) && !row.duplicate),
    [previewRows, selected],
  );
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const row of selectedRows) {
      if (row.type === "income") income += row.amountCents;
      else expense += row.amountCents;
    }
    return { income, expense, count: selectedRows.length };
  }, [selectedRows]);

  const processFile = useCallback(async (file: File) => {
    setError(null);
    setMessage(null);
    setPreviewRows([]);
    setSelected(new Set());
    setFileName(file.name);

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "ofx" && ext !== "qfx" && ext !== "txt") {
      setError("Formato inválido. Selecione um arquivo .ofx, .qfx ou .txt.");
      return;
    }

    const buffer = await file.arrayBuffer();
    const text = decodeOfxCharset(buffer);
    const result = parseImportFileFull("ofx", text);

    setOfxAcctId(result.acctId);
    setDrafts(result.transactions);

    if (!result.transactions.length) {
      setError("Não encontrei lançamentos no arquivo. Confira se é um extrato OFX válido.");
      return;
    }

    setPhase("preview");
  }, []);

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) await processFile(file);
  }

  async function analyze() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await previewImport({ accountId: cardId, cardId, source: "ofx", fileName, rows: drafts });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPreviewRows(result.rows);
    setSelected(new Set(result.rows.filter((row) => !row.duplicate && !row.possibleMatch).map((row) => row.clientId)));
    setMessage(
      `${result.rows.length} lançamento(s) analisado(s), ${result.duplicateCount} duplicado(s), ${result.matchCount} possível(is) conciliação(ões).`,
    );
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await confirmImport({
      accountId: cardId,
      cardId,
      source: "ofx",
      fileName,
      rows: drafts,
      selectedClientIds: [...selected],
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    // Save ACCTID → card mapping if available
    if (ofxAcctId && cardId) {
      await saveAcctIdMapping(ofxAcctId, cardId);
    }

    setMessage(`${result.imported ?? 0} lançamento(s) importado(s). ${result.skipped ?? 0} ignorado(s).`);
    setDrafts([]);
    setPreviewRows([]);
    setSelected(new Set());
    setFileName("");
    setOfxAcctId(null);
    setPhase("upload");
    router.refresh();
  }

  function toggle(clientId: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(clientId);
    else next.delete(clientId);
    setSelected(next);
  }

  function selectAllImportable() {
    setSelected(new Set(previewRows.filter((row) => !row.duplicate).map((row) => row.clientId)));
  }

  function handleClose() {
    setDrafts([]);
    setPreviewRows([]);
    setSelected(new Set());
    setFileName("");
    setOfxAcctId(null);
    setPhase("upload");
    setError(null);
    setMessage(null);
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Importar fatura" description="Importe o extrato OFX do cartão e revise antes de confirmar." className="sm:max-w-2xl">
      <div className="space-y-4">
        {/* Card selector */}
        <div>
          <label className="mb-1 block text-sm font-medium">Cartão de destino</label>
          <Select value={cardId} onChange={(e) => setCardId(e.target.value)}>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>

        {/* File upload */}
        {phase === "upload" && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition",
              dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
            )}
          >
            <FileUp className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Arraste o arquivo .ofx aqui ou clique para selecionar</p>
            <p className="text-xs text-muted-foreground">Extrato exportado pelo app do banco (Nubank, Inter, etc.)</p>
            <Input
              ref={fileRef}
              type="file"
              accept=".ofx,.qfx,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void processFile(file);
              }}
            />
          </div>
        )}

        {/* File loaded */}
        {phase === "upload" && fileName && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileUp className="h-4 w-4" />
            {fileName} — {drafts.length} lançamento(s) lido(s)
          </div>
        )}

        {/* Errors / messages */}
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}
        {message && (
          <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> {message}
          </div>
        )}

        {/* Analyze button */}
        {phase === "preview" && !previewRows.length && (
          <Button onClick={analyze} disabled={busy || !cardId || !drafts.length} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchCheck className="h-4 w-4" />}
            Analisar lançamentos
          </Button>
        )}

        {/* Preview table */}
        {previewRows.length > 0 && (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <SummaryCard label="Selecionados" value={`${totals.count}`} />
              <SummaryCard label="Receitas" value={formatBRL(totals.income)} className="text-success" />
              <SummaryCard label="Despesas" value={formatBRL(totals.expense)} className="text-destructive" />
              <SummaryCard label="Resultado" value={formatBRL(totals.income - totals.expense)} className={totals.income - totals.expense < 0 ? "text-destructive" : "text-success"} />
            </div>

            <div className="max-h-[40vh] overflow-y-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Importar</th>
                    <th className="px-3 py-2 font-medium">Data</th>
                    <th className="px-3 py-2 font-medium">Descrição</th>
                    <th className="px-3 py-2 font-medium">Tipo</th>
                    <th className="px-3 py-2 text-right font-medium">Valor</th>
                    <th className="px-3 py-2 font-medium">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => {
                    const disabled = row.duplicate;
                    return (
                      <tr key={row.clientId} className={cn("border-b last:border-0", row.duplicate && "bg-muted/40")}>
                        <td className="px-3 py-1.5">
                          <input
                            type="checkbox"
                            disabled={disabled}
                            checked={selected.has(row.clientId) && !disabled}
                            onChange={(e) => toggle(row.clientId, e.target.checked)}
                            className="h-4 w-4"
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5">{formatDate(row.date)}</td>
                        <td className="min-w-[180px] px-3 py-1.5">
                          <p className="font-medium">{row.description}</p>
                          {row.externalId && <p className="text-xs text-muted-foreground">ID: {row.externalId}</p>}
                        </td>
                        <td className="px-3 py-1.5">{row.type === "income" ? "Receita" : "Despesa"}</td>
                        <td className={cn("tabular px-3 py-1.5 text-right font-medium", row.type === "income" ? "text-success" : "text-destructive")}>
                          {row.type === "income" ? "+" : "-"}{formatBRL(row.amountCents)}
                        </td>
                        <td className="px-3 py-1.5">
                          {row.duplicate ? (
                            <Badge className="border-destructive/30 bg-destructive/10 text-destructive">Duplicado</Badge>
                          ) : row.possibleMatch ? (
                            <div className="space-y-0.5">
                              <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">Possível conciliação</Badge>
                              <p className="text-xs text-muted-foreground">
                                {row.possibleMatch.description} — {formatDate(row.possibleMatch.date)}
                              </p>
                            </div>
                          ) : (
                            <Badge className="border-success/30 bg-success/10 text-success">Novo</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-2">
              <Button variant="outline" size="sm" onClick={selectAllImportable}>Selecionar importáveis</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setPhase("upload"); setPreviewRows([]); }}>
                  Voltar
                </Button>
                <Button onClick={confirm} disabled={busy || selectedRows.length === 0} className="gap-2">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Importar {selectedRows.length > 0 ? `${selectedRows.length} lançamento(s)` : ""}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}

function SummaryCard({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("tabular text-lg font-bold", className)}>{value}</p>
    </div>
  );
}
