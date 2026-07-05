import { z } from "zod";

export const importedDraftSchema = z.object({
  clientId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  description: z.string().trim().min(1).max(120),
  amountCents: z.number().int().positive(),
  type: z.enum(["income", "expense"]),
  externalId: z.string().trim().max(120).nullable(),
});

export const importPreviewSchema = z.object({
  accountId: z.string().uuid("Selecione a conta"),
  cardId: z.string().uuid().optional().nullable(),
  source: z.enum(["ofx", "csv"]),
  fileName: z.string().trim().min(1).max(180),
  rows: z.array(importedDraftSchema).min(1, "Nenhum lançamento encontrado").max(1000, "Importe até 1000 linhas por lote"),
});

export const importConfirmSchema = importPreviewSchema.extend({
  selectedClientIds: z.array(z.string().min(1)).default([]),
});

export type ImportPreviewInput = z.infer<typeof importPreviewSchema>;
export type ImportConfirmInput = z.infer<typeof importConfirmSchema>;
export type CardImportInput = ImportPreviewInput & { cardId: string };
