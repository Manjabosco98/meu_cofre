import { z } from "zod";

export const VAULT_TYPES = [
  "email", "platform", "bank", "card", "api", "system", "server", "social", "subscription", "other",
] as const;
export const VAULT_STATUSES = ["active", "inactive", "expired", "revoked"] as const;

// Campo cifrado: string base64 opaca (o servidor nunca decifra). "" ou null = sem valor.
const encryptedField = z.string().max(20000).nullable().optional();

export const vaultItemSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do acesso").max(120),
  type: z.enum(VAULT_TYPES),
  url: z
    .string()
    .trim()
    .max(2000)
    .url("URL inválida")
    .optional()
    .nullable()
    .or(z.literal("")),
  username: z.string().trim().max(320).optional().nullable(),
  encrypted_password: encryptedField,
  encrypted_notes: encryptedField,
  encrypted_token: encryptedField,
  encrypted_api_key: encryptedField,
  category: z.string().trim().max(80).optional().nullable(),
  status: z.enum(VAULT_STATUSES),
  has_2fa: z.boolean().default(false),
  recovery_email: z
    .string()
    .trim()
    .email("E-mail de recuperação inválido")
    .optional()
    .nullable()
    .or(z.literal("")),
  recovery_phone: z.string().trim().max(40).optional().nullable(),
  expires_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
    .optional()
    .nullable()
    .or(z.literal("")),
  favorite: z.boolean().default(false),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
});
export type VaultItemInput = z.infer<typeof vaultItemSchema>;

export const masterSetupSchema = z.object({
  salt: z.string().min(1),
  iterations: z.number().int().min(50_000).max(2_000_000),
  verifier: z.string().min(1).max(20000),
});
export type MasterSetupInput = z.infer<typeof masterSetupSchema>;

export const masterChangeSchema = masterSetupSchema.extend({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        encrypted_password: encryptedField,
        encrypted_notes: encryptedField,
        encrypted_token: encryptedField,
        encrypted_api_key: encryptedField,
      }),
    )
    .max(5000),
});
export type MasterChangeInput = z.infer<typeof masterChangeSchema>;

export const secretAccessSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["viewed_secret", "copied_secret"]),
  field: z.string().max(40).optional(),
});
export type SecretAccessInput = z.infer<typeof secretAccessSchema>;
