import type { Database } from "@/lib/database.types";

export type VaultItemType = Database["public"]["Enums"]["vault_item_type"];
export type VaultItemStatus = Database["public"]["Enums"]["vault_item_status"];
export type VaultAuditAction = Database["public"]["Enums"]["vault_audit_action"];

/** Parâmetros do cofre (sem a senha-mestra, que nunca é persistida). */
export interface VaultConfig {
  salt: string;
  iterations: number;
  verifier: string;
}

/** Linha do cofre como vem do banco (campos encrypted_* são base64 opacos). */
export interface VaultItem {
  id: string;
  name: string;
  type: VaultItemType;
  url: string | null;
  username: string | null;
  encrypted_password: string | null;
  encrypted_notes: string | null;
  encrypted_token: string | null;
  encrypted_api_key: string | null;
  category: string | null;
  status: VaultItemStatus;
  has_2fa: boolean;
  recovery_email: string | null;
  recovery_phone: string | null;
  expires_at: string | null;
  favorite: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface VaultAuditEntry {
  id: string;
  action: VaultAuditAction;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/** Valores do formulário (segredos em texto puro, só em memória). */
export interface VaultItemForm {
  name: string;
  type: VaultItemType;
  url: string;
  username: string;
  password: string;
  notes: string;
  token: string;
  apiKey: string;
  category: string;
  status: VaultItemStatus;
  has2fa: boolean;
  recoveryEmail: string;
  recoveryPhone: string;
  expiresAt: string;
  favorite: boolean;
  tags: string; // separadas por vírgula na UI
}

export const TYPE_LABELS: Record<VaultItemType, string> = {
  email: "E-mail",
  platform: "Plataforma",
  bank: "Banco",
  card: "Cartão",
  api: "API",
  system: "Sistema interno",
  server: "Servidor",
  social: "Rede social",
  subscription: "Assinatura",
  other: "Outro",
};

export const STATUS_LABELS: Record<VaultItemStatus, string> = {
  active: "Ativo",
  inactive: "Inativo",
  expired: "Expirado",
  revoked: "Revogado",
};

export const STATUS_CLASSES: Record<VaultItemStatus, string> = {
  active: "border-success/40 bg-success/10 text-success",
  inactive: "border-muted-foreground/30 bg-muted text-muted-foreground",
  expired: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  revoked: "border-destructive/40 bg-destructive/10 text-destructive",
};
