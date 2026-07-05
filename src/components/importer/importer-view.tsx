"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileUp, Loader2, SearchCheck, Upload } from "lucide-react";
import { previewImport, confirmImport, saveAcctIdMapping, type ImportPreviewRow } from "@/app/(app)/importar/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatBRL, formatDate } from "@/lib/format";
import { parseImportFileFull, decodeOfxCharset, type ImportedDraft, type ImportSource } from "@/lib/import-parser";
import { cn } from "@/lib/utils";

export interface ImportAccount {
  id: string;
  name: string;
}

export interface ImportCardOption {
  id: string;
  name: string;
}

export interface ImportBatchRow {
  id: string;
  file_name: string;
  source: ImportSource;
  imported_count: number;
  duplicate_count: number;
  created_at: string;
}

interface Props {
  accounts: ImportAccount[];
  cards: ImportCardOption[];
  batches: ImportBatchRow[];
}

function typeLabel(type: "income" | "expense") {
  return type === "income" ? "Receita" : "Despesa";
}

export function ImporterView({ accounts, cards, batches }: Props) {
  const router = useRouter();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [cardId, setCardId] = useState<string>("");
  const [source, setSource] = useState<ImportSource>("ofx");
  const [fileName, setFileName] = useState("");
  const [drafts, setDrafts] = useState<ImportedDraft[]>([]);
  const [ofxAcctId, setOfxAcctId] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isCardImport = !!cardId;
  const targetId = isCardImport ? cardId : accountId;

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

  async function readFile(file: File) {
    setError(null);
    setMessage(null);
    setPreviewRows([]);
    setSelected(new Set());
    setFileName(file.name);
    if (source === "ofx") {
      const buffer = await file.arrayBuffer();
      const text = decodeOfxCharset(buffer);
      const result = parseImportFileFull("ofx", text);
      setOfxAcctId(result.acctId);
      setDrafts(result.transactions);
      if (!result.transactions.length) {
        setError("Não encontrei lançamentos no arquivo. Confira se é um extrato OFX válido.");
      }
    } else {
      const text = await file.text();
      const parsed = parseImportFileFull("csv", text);
      setDrafts(parsed.transactions);
      setOfxAcctId(null);
      if (!parsed.transactions.length) {
        setError("Não encontrei lançamentos no arquivo. Confira o formato e os cabeçalhos do CSV.");
      }
    }
  }

  async function analyze() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await previewImport({
      accountId: targetId,
      cardId: cardId || undefined,
      source,
      fileName,
      rows: drafts,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPreviewRows(result.rows);
    setSelected(new Set(result.rows.filter((row) => !row.duplicate && !row.possibleMatch).map((row) => row.clientId)));
    setMessage(`${result.rows.length} linha(s) analisadas, ${result.duplicateCount} duplicada(s), ${result.matchCount} possível(is) conciliação(ões).`);
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await confirmImport({
      accountId: targetId,
      cardId: cardId || undefined,
      source,
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importar / conciliar</h1>
        <p className="mt-1 text-muted-foreground">Importe OFX ou CSV, revise duplicados e confirme os lançamentos novos.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Novo lote</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[180px_1fr_1fr_1fr_auto]">
            <Select value={source} onChange={(e) => setSource(e.target.value as ImportSource)}>
              <option value="ofx">OFX</option>
              <option value="csv">CSV</option>
            </Select>
            <Select value={accountId} onChange={(e) => { setAccountId(e.target.value); setCardId(""); }}>
              <option value="">— Conta —</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </Select>
            {cards.length > 0 && (
              <Select value={cardId} onChange={(e) => { setCardId(e.target.value); if (e.target.value) setAccountId(""); }}>
                <option value="">— Cartão (opcional) —</option>
                {cards.map((card) => (
                  <option key={card.id} value={card.id}>{card.name}</option>
                ))}
              </Select>
            )}
            <Input
              type="file"
              accept={source === "ofx" ? ".ofx,.qfx,.txt" : ".csv,.txt"}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void readFile(file);
              }}
            />
            <Button onClick={analyze} disabled={busy || !targetId || !drafts.length} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchCheck className="h-4 w-4" />}
              Analisar
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <FileUp className="h-4 w-4" />
            {fileName ? `${fileName} - ${drafts.length} linha(s) lida(s)` : "Selecione um arquivo para começar."}
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" /> {error}
            </div>
          )}
          {message && (
            <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" /> {message}
            </div>
          )}
        </CardContent>
      </Card>

      {previewRows.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <SummaryCard label="Selecionados" value={`${totals.count}`} />
            <SummaryCard label="Entradas" value={formatBRL(totals.income)} className="text-success" />
            <SummaryCard label="Saídas" value={formatBRL(totals.expense)} className="text-destructive" />
            <SummaryCard label="Resultado" value={formatBRL(totals.income - totals.expense)} className={totals.income - totals.expense < 0 ? "text-destructive" : "text-success"} />
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Prévia e conciliação</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllImportable}>Selecionar importáveis</Button>
                <Button onClick={confirm} disabled={busy || selectedRows.length === 0} className="gap-2">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Confirmar importação
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Importar</th>
                      <th className="px-4 py-2 font-medium">Data</th>
                      <th className="px-4 py-2 font-medium">Descrição</th>
                      <th className="px-4 py-2 font-medium">Tipo</th>
                      <th className="px-4 py-2 text-right font-medium">Valor</th>
                      <th className="px-4 py-2 font-medium">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row) => {
                      const disabled = row.duplicate;
                      return (
                        <tr key={row.clientId} className={cn("border-b last:border-0", row.duplicate && "bg-muted/40")}>
                          <td className="px-4 py-2">
                            <input
                              type="checkbox"
                              disabled={disabled}
                              checked={selected.has(row.clientId) && !disabled}
                              onChange={(e) => toggle(row.clientId, e.target.checked)}
                              className="h-4 w-4"
                            />
                          </td>
                          <td className="whitespace-nowrap px-4 py-2">{formatDate(row.date)}</td>
                          <td className="min-w-[240px] px-4 py-2">
                            <p className="font-medium">{row.description}</p>
                            {row.externalId && <p className="text-xs text-muted-foreground">ID externo: {row.externalId}</p>}
                          </td>
                          <td className="px-4 py-2">{typeLabel(row.type)}</td>
                          <td className={cn("tabular px-4 py-2 text-right font-medium", row.type === "income" ? "text-success" : "text-destructive")}>
                            {row.type === "income" ? "+" : "-"}{formatBRL(row.amountCents)}
                          </td>
                          <td className="px-4 py-2">
                            {row.duplicate ? (
                              <Badge className="border-destructive/30 bg-destructive/10 text-destructive">Duplicado</Badge>
                            ) : row.possibleMatch ? (
                              <div className="space-y-1">
                                <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">Possível conciliação</Badge>
                                <p className="text-xs text-muted-foreground">
                                  {row.possibleMatch.description} - {formatDate(row.possibleMatch.date)}
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
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader><CardTitle>Histórico de importações</CardTitle></CardHeader>
        <CardContent className="p-0">
          {batches.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Arquivo</th>
                    <th className="px-4 py-2 font-medium">Origem</th>
                    <th className="px-4 py-2 text-right font-medium">Importados</th>
                    <th className="px-4 py-2 text-right font-medium">Duplicados</th>
                    <th className="px-4 py-2 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr key={batch.id} className="border-b last:border-0">
                      <td className="px-4 py-2 font-medium">{batch.file_name}</td>
                      <td className="px-4 py-2 uppercase">{batch.source}</td>
                      <td className="tabular px-4 py-2 text-right">{batch.imported_count}</td>
                      <td className="tabular px-4 py-2 text-right">{batch.duplicate_count}</td>
                      <td className="px-4 py-2">{formatDate(batch.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhum lote importado ainda.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={cn("tabular text-xl font-bold", className)}>{value}</p>
      </CardContent>
    </Card>
  );
}
