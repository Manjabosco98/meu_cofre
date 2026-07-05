import { toCents } from "@/lib/money";

export type ImportSource = "ofx" | "csv";
export type ImportedKind = "income" | "expense";

export interface ImportedDraft {
  clientId: string;
  date: string;
  description: string;
  amountCents: number;
  type: ImportedKind;
  externalId: string | null;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeHeader(value: string) {
  return normalizeText(value).replace(/\s/g, "");
}

export function normalizeImportDescription(value: string) {
  return normalizeText(value).slice(0, 120);
}

function cleanDescription(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 120) || "Lançamento importado";
}

function parseDate(value: string): string | null {
  const raw = value.trim();
  const ofx = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if (ofx) return `${ofx[1]}-${ofx[2]}-${ofx[3]}`;

  const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return `${iso[1]}-${pad(Number(iso[2]))}-${pad(Number(iso[3]))}`;

  const br = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (br) {
    const year = Number(br[3]) < 100 ? 2000 + Number(br[3]) : Number(br[3]);
    return `${year}-${pad(Number(br[2]))}-${pad(Number(br[1]))}`;
  }
  return null;
}

function signedToDraft(
  clientId: string,
  date: string,
  description: string,
  signedCents: number,
  externalId?: string | null,
): ImportedDraft | null {
  if (!date || !description || signedCents === 0) return null;
  return {
    clientId,
    date,
    description: cleanDescription(description),
    amountCents: Math.abs(signedCents),
    type: signedCents >= 0 ? "income" : "expense",
    externalId: externalId?.trim() || null,
  };
}

function tag(block: string, name: string) {
  const re = new RegExp(`<${name}>([^<\\r\\n]+)`, "i");
  return block.match(re)?.[1]?.trim() ?? "";
}

export function parseOfx(text: string): ImportedDraft[] {
  return parseOfxFile(text).transactions;
}

export interface OfxFileData {
  acctId: string | null;
  org: string | null;
  curDef: string | null;
  transactions: ImportedDraft[];
}

export function parseOfxFile(text: string): OfxFileData {
  const normalized = text.replace(/\r/g, "");

  // Extract header-level fields (before BANKTRANLIST)
  const headerSection = normalized.slice(0, normalized.indexOf("<BANKTRANLIST>") || normalized.length);
  const acctId = tag(headerSection, "ACCTID") || null;
  const org = tag(headerSection, "ORG") || null;
  const curDef = tag(headerSection, "CURDEF") || null;

  const matches = [...normalized.matchAll(/<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>|$)/gi)];
  const transactions = matches
    .map((match, index) => {
      const block = match[1];
      const date = parseDate(tag(block, "DTPOSTED"));
      const amount = Number(tag(block, "TRNAMT").replace(",", "."));
      const description = tag(block, "MEMO") || tag(block, "NAME") || tag(block, "CHECKNUM");
      if (!date || Number.isNaN(amount)) return null;
      return signedToDraft(
        `ofx-${index}`,
        date,
        description,
        Math.round(amount * 100),
        tag(block, "FITID") || null,
      );
    })
    .filter(Boolean) as ImportedDraft[];

  return { acctId, org, curDef, transactions };
}

function detectDelimiter(firstLine: string) {
  const semis = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return semis >= commas ? ";" : ",";
}

function parseCsvLine(line: string, delimiter: string) {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"' && quoted && next === '"') {
      cur += '"';
      i++;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function findIndex(headers: string[], candidates: string[]) {
  return headers.findIndex((h) => candidates.includes(h));
}

export function parseCsv(text: string): ImportedDraft[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map(normalizeHeader);
  const dateIdx = findIndex(headers, ["data", "date", "dtdata", "datamovimento", "posteddate"]);
  const descIdx = findIndex(headers, ["descricao", "description", "historico", "memo", "payee", "nome", "lancamento"]);
  const amountIdx = findIndex(headers, ["valor", "amount", "vlr", "valortransacao", "valorlancamento", "valorancamento"]);
  const creditIdx = findIndex(headers, ["credito", "credit", "entrada", "receita"]);
  const debitIdx = findIndex(headers, ["debito", "debit", "saida", "despesa"]);
  const idIdx = findIndex(headers, ["id", "fitid", "externalid", "identificador", "documento"]);

  if (dateIdx < 0 || descIdx < 0 || (amountIdx < 0 && creditIdx < 0 && debitIdx < 0)) return [];

  return lines.slice(1)
    .map((line, index) => {
      const cols = parseCsvLine(line, delimiter);
      const date = parseDate(cols[dateIdx] ?? "");
      if (!date) return null;

      let signedCents = 0;
      if (amountIdx >= 0) {
        signedCents = toCents(cols[amountIdx] ?? "0");
      } else {
        const credit = creditIdx >= 0 ? toCents(cols[creditIdx] ?? "0") : 0;
        const debit = debitIdx >= 0 ? toCents(cols[debitIdx] ?? "0") : 0;
        signedCents = credit > 0 ? credit : -Math.abs(debit);
      }

      return signedToDraft(
        `csv-${index}`,
        date,
        cols[descIdx] ?? "",
        signedCents,
        idIdx >= 0 ? cols[idIdx] : null,
      );
    })
    .filter(Boolean) as ImportedDraft[];
}

export function parseImportFile(source: ImportSource, text: string) {
  return source === "ofx" ? parseOfx(text) : parseCsv(text);
}

export function parseImportFileFull(source: ImportSource, text: string) {
  if (source === "ofx") return parseOfxFile(text);
  return { acctId: null, org: null, curDef: null, transactions: parseCsv(text) };
}

export function decodeOfxCharset(buffer: ArrayBuffer): string {
  const raw = new Uint8Array(buffer);
  // Scan first 500 bytes for <CHARSET:...> (ASCII-safe)
  const head = new TextDecoder("ascii").decode(raw.slice(0, 500));
  const m = head.match(/<CHARSET:\s*([A-Za-z0-9_-]+)/i);
  const charset = m?.[1] ?? "";
  // UTF-8 variants
  if (!charset || /utf-?8/i.test(charset) || charset === "10008") {
    return new TextDecoder("utf-8").decode(buffer);
  }
  return new TextDecoder("windows-1252").decode(buffer);
}

export function importFingerprint(
  accountId: string,
  row: Pick<ImportedDraft, "date" | "amountCents" | "type" | "description" | "externalId">,
  cardId?: string,
) {
  let base: string;
  if (cardId && row.externalId) {
    // Credit card: composite key to handle Nubank's reused FITID
    base = `card:${cardId}:${row.externalId}:${row.date}:${row.amountCents}:${normalizeImportDescription(row.description)}`;
  } else if (row.externalId) {
    base = `ext:${accountId}:${row.externalId}`;
  } else {
    base = `fp:${accountId}:${row.date}:${row.type}:${row.amountCents}:${normalizeImportDescription(row.description)}`;
  }
  let hash = 2166136261;
  for (let i = 0; i < base.length; i++) {
    hash ^= base.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `imp_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
