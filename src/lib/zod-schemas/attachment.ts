import { z } from "zod";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
] as const;

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const attachmentInputSchema = z.object({
  transaction_id: z.string().uuid(),
  file_name: z.string().trim().min(1, "Nome do arquivo inválido").max(255),
  mime_type: z.enum(ALLOWED_MIME_TYPES, {
    message: "Tipo de arquivo não permitido. Envie imagens (JPG, PNG, GIF, WebP) ou PDF.",
  }),
  size_bytes: z
    .number()
    .int()
    .positive()
    .max(MAX_SIZE_BYTES, "Arquivo muito grande (máximo 10 MB)"),
  storage_key: z.string().min(1),
});

export type AttachmentInput = z.infer<typeof attachmentInputSchema>;

export { ALLOWED_MIME_TYPES, MAX_SIZE_BYTES };
