import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(60),
  kind: z.enum(["income", "expense"]),
  parent_id: z.string().uuid().optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida")
    .default("#64748b"),
  icon: z.string().default("tag"),
});

export type CategoryInput = z.infer<typeof categorySchema>;

export const tagSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(40),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida")
    .default("#0ea5e9"),
});

export type TagInput = z.infer<typeof tagSchema>;
