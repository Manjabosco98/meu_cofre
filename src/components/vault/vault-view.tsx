"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  KeyRound, Plus, Wand2, Lock, Search, Star, Eye, EyeOff, Copy, Pencil, Trash2,
  ShieldCheck, Loader2, AlertTriangle, ExternalLink, Check, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { MasterPasswordSetup } from "@/components/vault/master-password-setup";
import { VaultLocked } from "@/components/vault/vault-locked";
import { VaultItemDialog, type EditingItem } from "@/components/vault/vault-item-dialog";
import { PasswordGenerator } from "@/components/vault/password-generator";
import { ChangeMasterDialog } from "@/components/vault/change-master-dialog";
import { cn } from "@/lib/utils";
import { decryptField, encryptField } from "@/lib/vault-crypto";
import {
  createVaultItem, updateVaultItem, deleteVaultItem, toggleVaultFavorite, logSecretAccess,
} from "@/app/(app)/configuracoes/cofre/actions";
import type { VaultItemInput } from "@/lib/zod-schemas/vault";
import {
  TYPE_LABELS, STATUS_LABELS, STATUS_CLASSES,
  type VaultConfig, type VaultItem, type VaultAuditEntry, type VaultItemForm,
  type VaultItemType, type VaultItemStatus,
} from "@/components/vault/types";

const AUTO_LOCK_MS = 5 * 60 * 1000;
const REVEAL_MS = 10 * 1000;
const CLIPBOARD_CLEAR_MS = 20 * 1000;

interface Props {
  config: VaultConfig | null;
  items: VaultItem[];
  logs: VaultAuditEntry[];
}

const todayStr = () => new Date().toISOString().slice(0, 10);
function isExpired(it: VaultItem): boolean {
  return it.status === "expired" || (!!it.expires_at && it.expires_at < todayStr());
}

export function VaultView({ config, items, logs }: Props) {
  const router = useRouter();
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);

  // Filtros (estado local — nada sensível na URL)
  const [q, setQ] = useState("");
  const [fType, setFType] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fCategory, setFCategory] = useState("");
  const [fTag, setFTag] = useState("");
  const [onlyFav, setOnlyFav] = useState(false);
  const [only2fa, setOnly2fa] = useState(false);

  // Dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EditingItem | null>(null);
  const [genOpen, setGenOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [toDelete, setToDelete] = useState<VaultItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Revelação de senha (uma por vez) + feedback de cópia
  const [reveal, setReveal] = useState<{ id: string; value: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const lock = useCallback(() => {
    setCryptoKey(null);
    setReveal(null);
  }, []);

  // Auto-bloqueio por inatividade (+ ao sair da página).
  useEffect(() => {
    if (!cryptoKey) return;
    let timer = window.setTimeout(lock, AUTO_LOCK_MS);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(lock, AUTO_LOCK_MS);
    };
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    window.addEventListener("beforeunload", lock);
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
      window.removeEventListener("beforeunload", lock);
    };
  }, [cryptoKey, lock]);

  // ---- Estados de tela ----
  const header = (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cofre de acessos</h1>
        <p className="mt-1 text-muted-foreground">
          Guarde senhas, e-mails, tokens e acessos importantes com segurança.
        </p>
      </div>
      <SettingsTabs />
    </div>
  );

  if (!config) {
    return (
      <div className="space-y-6">
        {header}
        <MasterPasswordSetup onUnlocked={setCryptoKey} />
      </div>
    );
  }
  if (!cryptoKey) {
    return (
      <div className="space-y-6">
        {header}
        <VaultLocked config={config} onUnlocked={setCryptoKey} />
      </div>
    );
  }

  return (
    <UnlockedVault
      header={header}
      cryptoKey={cryptoKey}
      setKey={setCryptoKey}
      config={config}
      items={items}
      logs={logs}
      lock={lock}
      router={router}
      state={{
        q, setQ, fType, setFType, fStatus, setFStatus, fCategory, setFCategory,
        fTag, setFTag, onlyFav, setOnlyFav, only2fa, setOnly2fa,
        formOpen, setFormOpen, editing, setEditing, genOpen, setGenOpen,
        changeOpen, setChangeOpen, toDelete, setToDelete, busyId, setBusyId,
        reveal, setReveal, copied, setCopied,
      }}
    />
  );
}

// Componente do conteúdo desbloqueado (separado só para clareza).
type StateBag = {
  q: string; setQ: (v: string) => void;
  fType: string; setFType: (v: string) => void;
  fStatus: string; setFStatus: (v: string) => void;
  fCategory: string; setFCategory: (v: string) => void;
  fTag: string; setFTag: (v: string) => void;
  onlyFav: boolean; setOnlyFav: (v: boolean) => void;
  only2fa: boolean; setOnly2fa: (v: boolean) => void;
  formOpen: boolean; setFormOpen: (v: boolean) => void;
  editing: EditingItem | null; setEditing: (v: EditingItem | null) => void;
  genOpen: boolean; setGenOpen: (v: boolean) => void;
  changeOpen: boolean; setChangeOpen: (v: boolean) => void;
  toDelete: VaultItem | null; setToDelete: (v: VaultItem | null) => void;
  busyId: string | null; setBusyId: (v: string | null) => void;
  reveal: { id: string; value: string } | null; setReveal: (v: { id: string; value: string } | null) => void;
  copied: string | null; setCopied: (v: string | null) => void;
};

function UnlockedVault({
  header, cryptoKey, setKey, config, items, logs, lock, router, state,
}: {
  header: React.ReactNode;
  cryptoKey: CryptoKey;
  setKey: (k: CryptoKey) => void;
  config: VaultConfig;
  items: VaultItem[];
  logs: VaultAuditEntry[];
  lock: () => void;
  router: ReturnType<typeof useRouter>;
  state: StateBag;
}) {
  const s = state;
  const revealTimer = useRef<number>();

  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category).filter(Boolean))) as string[],
    [items],
  );
  const allTags = useMemo(
    () => Array.from(new Set(items.flatMap((i) => i.tags))).sort(),
    [items],
  );
  const dupKeys = useMemo(() => {
    const seen = new Map<string, number>();
    for (const it of items) {
      const k = `${it.name.toLowerCase()}|${(it.username ?? "").toLowerCase()}`;
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    return seen;
  }, [items]);

  const filtered = useMemo(() => {
    const query = s.q.trim().toLowerCase();
    return items.filter((it) => {
      if (query) {
        const hay = `${it.name} ${it.username ?? ""} ${it.url ?? ""}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      if (s.fType && it.type !== s.fType) return false;
      if (s.fStatus && it.status !== s.fStatus) return false;
      if (s.fCategory && it.category !== s.fCategory) return false;
      if (s.fTag && !it.tags.includes(s.fTag)) return false;
      if (s.onlyFav && !it.favorite) return false;
      if (s.only2fa && !it.has_2fa) return false;
      return true;
    });
  }, [items, s.q, s.fType, s.fStatus, s.fCategory, s.fTag, s.onlyFav, s.only2fa]);

  const summary = useMemo(() => ({
    total: items.length,
    favorites: items.filter((i) => i.favorite).length,
    with2fa: items.filter((i) => i.has_2fa).length,
    expired: items.filter(isExpired).length,
    inactive: items.filter((i) => i.status === "inactive").length,
  }), [items]);

  // ---- Ações de segredo ----
  const clearReveal = useCallback(() => {
    if (revealTimer.current) window.clearTimeout(revealTimer.current);
    s.setReveal(null);
  }, [s]);

  async function revealPassword(it: VaultItem) {
    if (!it.encrypted_password) return;
    if (s.reveal?.id === it.id) {
      clearReveal();
      return;
    }
    try {
      const value = await decryptField(cryptoKey, it.encrypted_password);
      s.setReveal({ id: it.id, value });
      if (revealTimer.current) window.clearTimeout(revealTimer.current);
      revealTimer.current = window.setTimeout(() => s.setReveal(null), REVEAL_MS);
      void logSecretAccess({ id: it.id, action: "viewed_secret", field: "password" });
    } catch {
      /* ignore */
    }
  }

  async function copySecret(it: VaultItem, field: "password") {
    const cipher = it.encrypted_password;
    if (!cipher) return;
    try {
      const value = await decryptField(cryptoKey, cipher);
      await navigator.clipboard.writeText(value);
      s.setCopied(`${it.id}:${field}`);
      setTimeout(() => s.setCopied(null), 1500);
      // Limpa a área de transferência depois de um tempo (best-effort).
      setTimeout(() => { navigator.clipboard.writeText("").catch(() => {}); }, CLIPBOARD_CLEAR_MS);
      void logSecretAccess({ id: it.id, action: "copied_secret", field });
    } catch {
      /* ignore */
    }
  }

  async function copyUsername(it: VaultItem) {
    if (!it.username) return;
    try {
      await navigator.clipboard.writeText(it.username);
      s.setCopied(`${it.id}:user`);
      setTimeout(() => s.setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  }

  // ---- CRUD ----
  async function openCreate() {
    s.setEditing(null);
    s.setFormOpen(true);
  }
  async function openEdit(it: VaultItem) {
    const dec = async (v: string | null) => (v ? await decryptField(cryptoKey, v) : "");
    s.setEditing({
      id: it.id,
      name: it.name,
      type: it.type,
      url: it.url ?? "",
      username: it.username ?? "",
      password: await dec(it.encrypted_password),
      notes: await dec(it.encrypted_notes),
      token: await dec(it.encrypted_token),
      apiKey: await dec(it.encrypted_api_key),
      category: it.category ?? "",
      status: it.status,
      has2fa: it.has_2fa,
      recoveryEmail: it.recovery_email ?? "",
      recoveryPhone: it.recovery_phone ?? "",
      expiresAt: it.expires_at ?? "",
      favorite: it.favorite,
      tags: it.tags.join(", "),
    });
    s.setFormOpen(true);
  }

  async function buildInput(form: VaultItemForm): Promise<VaultItemInput> {
    const enc = async (v: string) => (v ? await encryptField(cryptoKey, v) : null);
    return {
      name: form.name.trim(),
      type: form.type,
      url: form.url.trim(),
      username: form.username.trim(),
      encrypted_password: await enc(form.password),
      encrypted_notes: await enc(form.notes),
      encrypted_token: await enc(form.token),
      encrypted_api_key: await enc(form.apiKey),
      category: form.category.trim(),
      status: form.status,
      has_2fa: form.has2fa,
      recovery_email: form.recoveryEmail.trim(),
      recovery_phone: form.recoveryPhone.trim(),
      expires_at: form.expiresAt,
      favorite: form.favorite,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
  }

  async function handleSave(form: VaultItemForm) {
    const input = await buildInput(form);
    const res = s.editing
      ? await updateVaultItem(s.editing.id, input)
      : await createVaultItem(input);
    if (res.ok) router.refresh();
    return res;
  }

  async function toggleFav(it: VaultItem) {
    s.setBusyId(it.id);
    await toggleVaultFavorite(it.id, !it.favorite);
    s.setBusyId(null);
    router.refresh();
  }

  async function confirmDelete() {
    if (!s.toDelete) return;
    s.setBusyId(s.toDelete.id);
    await deleteVaultItem(s.toDelete.id);
    s.setBusyId(null);
    s.setToDelete(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {header}
        <div className="flex flex-wrap gap-2">
          <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> Novo acesso</Button>
          <Button variant="outline" onClick={() => s.setGenOpen(true)} className="gap-2"><Wand2 className="h-4 w-4" /> Gerar senha</Button>
          <Button variant="outline" onClick={() => s.setChangeOpen(true)} className="gap-2"><ShieldCheck className="h-4 w-4" /> Senha-mestra</Button>
          <Button variant="ghost" onClick={lock} className="gap-2"><Lock className="h-4 w-4" /> Bloquear</Button>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryCard label="Total de acessos" value={summary.total} />
        <SummaryCard label="Favoritos" value={summary.favorites} className="text-amber-500" />
        <SummaryCard label="Com 2FA" value={summary.with2fa} className="text-success" />
        <SummaryCard label="Expiradas" value={summary.expired} className="text-amber-600 dark:text-amber-400" />
        <SummaryCard label="Inativos" value={summary.inactive} className="text-muted-foreground" />
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={s.q} onChange={(e) => s.setQ(e.target.value)} placeholder="Buscar por nome, usuário ou URL" className="pl-9" />
          </div>
          <Select value={s.fType} onChange={(e) => s.setFType(e.target.value)} className="w-auto">
            <option value="">Todos os tipos</option>
            {(Object.keys(TYPE_LABELS) as VaultItemType[]).map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </Select>
          <Select value={s.fStatus} onChange={(e) => s.setFStatus(e.target.value)} className="w-auto">
            <option value="">Todos os status</option>
            {(Object.keys(STATUS_LABELS) as VaultItemStatus[]).map((st) => <option key={st} value={st}>{STATUS_LABELS[st]}</option>)}
          </Select>
          {categories.length > 0 && (
            <Select value={s.fCategory} onChange={(e) => s.setFCategory(e.target.value)} className="w-auto">
              <option value="">Todas as categorias</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          )}
          {allTags.length > 0 && (
            <Select value={s.fTag} onChange={(e) => s.setFTag(e.target.value)} className="w-auto">
              <option value="">Todas as tags</option>
              {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          )}
          <FilterToggle active={s.onlyFav} onClick={() => s.setOnlyFav(!s.onlyFav)}>Favoritos</FilterToggle>
          <FilterToggle active={s.only2fa} onClick={() => s.setOnly2fa(!s.only2fa)}>2FA</FilterToggle>
        </CardContent>
      </Card>

      {/* Lista */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <KeyRound className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium">Nenhum acesso encontrado</p>
            <p className="max-w-xs text-sm text-muted-foreground">Ajuste os filtros ou cadastre um novo acesso.</p>
            <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> Novo acesso</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {filtered.map((it) => (
              <VaultRow
                key={it.id}
                item={it}
                revealed={s.reveal?.id === it.id ? s.reveal.value : null}
                copied={s.copied}
                busy={s.busyId === it.id}
                duplicate={(dupKeys.get(`${it.name.toLowerCase()}|${(it.username ?? "").toLowerCase()}`) ?? 0) > 1}
                onReveal={() => revealPassword(it)}
                onCopyPass={() => copySecret(it, "password")}
                onCopyUser={() => copyUsername(it)}
                onEdit={() => openEdit(it)}
                onDelete={() => s.setToDelete(it)}
                onFav={() => toggleFav(it)}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {logs.length > 0 && <AuditList logs={logs} />}

      <VaultItemDialog
        key={s.editing?.id ?? "new"}
        open={s.formOpen}
        onClose={() => s.setFormOpen(false)}
        editing={s.editing}
        onSave={handleSave}
      />
      <PasswordGenerator open={s.genOpen} onClose={() => s.setGenOpen(false)} />
      <ChangeMasterDialog
        open={s.changeOpen}
        onClose={() => s.setChangeOpen(false)}
        config={config}
        items={items}
        onChanged={setKey}
      />

      <Dialog open={!!s.toDelete} onClose={() => s.setToDelete(null)} title="Excluir acesso">
        <p className="mb-4 text-sm">Excluir <strong>{s.toDelete?.name}</strong>? Esta ação não pode ser desfeita.</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => s.setToDelete(null)}>Cancelar</Button>
          <Button variant="destructive" onClick={confirmDelete} disabled={s.busyId === s.toDelete?.id}>
            {s.busyId === s.toDelete?.id && <Loader2 className="h-4 w-4 animate-spin" />}
            Excluir
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function SummaryCard({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={cn("tabular text-2xl font-bold", className)}>{value}</p>
      </CardContent>
    </Card>
  );
}

function FilterToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition",
        active ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent",
      )}
    >
      <Star className={cn("h-3.5 w-3.5", active && "fill-current")} /> {children}
    </button>
  );
}

function VaultRow({
  item, revealed, copied, busy, duplicate,
  onReveal, onCopyPass, onCopyUser, onEdit, onDelete, onFav,
}: {
  item: VaultItem;
  revealed: string | null;
  copied: string | null;
  busy: boolean;
  duplicate: boolean;
  onReveal: () => void;
  onCopyPass: () => void;
  onCopyUser: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onFav: () => void;
}) {
  const expired = isExpired(item);
  const alerts: string[] = [];
  if (expired) alerts.push("Senha vencida");
  if (!item.has_2fa) alerts.push("Sem 2FA");
  if (!item.url) alerts.push("Sem URL");
  if (item.status === "inactive") alerts.push("Acesso inativo");
  if (duplicate) alerts.push("Possível duplicado");

  return (
    <div className="flex items-center gap-3 p-3 sm:px-4">
      <button onClick={onFav} className="shrink-0 text-muted-foreground hover:text-amber-500" aria-label="Favoritar" title="Favoritar">
        <Star className={cn("h-4 w-4", item.favorite && "fill-amber-400 text-amber-400")} />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium">{item.name}</p>
          <Badge className="border-border bg-muted text-muted-foreground">{TYPE_LABELS[item.type]}</Badge>
          <Badge className={STATUS_CLASSES[item.status]}>{STATUS_LABELS[item.status]}</Badge>
          {item.has_2fa && <Badge className="border-success/40 bg-success/10 text-success"><ShieldCheck className="h-3 w-3" /> 2FA</Badge>}
          {alerts.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400" title={alerts.join(" · ")}>
              <AlertTriangle className="h-3.5 w-3.5" /> {alerts.length}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {item.username && <span className="truncate"><User className="mr-1 inline h-3 w-3" />{item.username}</span>}
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 truncate hover:text-foreground hover:underline">
              <ExternalLink className="h-3 w-3" />{item.url.replace(/^https?:\/\//, "")}
            </a>
          )}
          <span>Atualizado {new Date(item.updated_at).toLocaleDateString("pt-BR")}</span>
        </div>
        {/* Senha mascarada / revelada */}
        <div className="mt-1 flex items-center gap-2">
          <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
            {item.encrypted_password ? (revealed ?? "••••••••••••") : "— sem senha —"}
          </code>
        </div>
        {item.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {item.tags.map((t) => (
              <span key={t} className="rounded-full bg-primary/10 px-1.5 text-[10px] font-medium text-primary">{t}</span>
            ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center">
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {item.encrypted_password && (
          <>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onReveal}
              aria-label={revealed ? "Ocultar senha" : "Mostrar senha"} title={revealed ? "Ocultar senha" : "Mostrar senha"}>
              {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCopyPass} aria-label="Copiar senha" title="Copiar senha">
              {copied === `${item.id}:password` ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </Button>
          </>
        )}
        {item.username && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCopyUser} aria-label="Copiar usuário" title="Copiar usuário">
            {copied === `${item.id}:user` ? <Check className="h-4 w-4 text-success" /> : <User className="h-4 w-4" />}
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} aria-label="Editar" title="Editar"><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete} aria-label="Excluir" title="Excluir"><Trash2 className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

const AUDIT_LABELS: Record<string, string> = {
  created: "Acesso criado",
  updated: "Acesso editado",
  viewed_secret: "Senha visualizada",
  copied_secret: "Senha copiada",
  deleted: "Acesso excluído",
  master_password_changed: "Senha-mestra alterada",
};

function AuditList({ logs }: { logs: VaultAuditEntry[] }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="mb-3 text-sm font-semibold">Histórico de atividade</p>
        <ul className="space-y-1.5 text-sm">
          {logs.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 text-muted-foreground">
              <span>{AUDIT_LABELS[l.action] ?? l.action}</span>
              <span className="tabular text-xs">{new Date(l.created_at).toLocaleString("pt-BR")}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
