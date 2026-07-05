import { z } from "zod";

const recurrenceSchema = z.object({
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
  interval: z.number().int().min(1).max(365),
  end_type: z.enum(["never", "date", "count"]),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  occurrences: z.number().int().min(1).max(600).optional().nullable(),
}).refine((d) => d.end_type !== "date" || !!d.end_date, {
  message: "Informe a data final",
  path: ["end_date"],
}).refine((d) => d.end_type !== "count" || !!d.occurrences, {
  message: "Informe o nº de repetições",
  path: ["occurrences"],
});

export const transactionSchema = z
  .object({
    type: z.enum(["income", "expense", "transfer"]),
    amount_cents: z.number().int().positive("Informe um valor maior que zero"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
    description: z.string().trim().min(1, "Informe a descrição").max(120),
    account_id: z.string().uuid("Selecione a conta"),
    to_account_id: z.string().uuid().optional().nullable(),
    category_id: z.string().uuid().optional().nullable(),
    tag_ids: z.array(z.string().uuid()).default([]),
    notes: z.string().trim().max(500).optional().nullable(),
    status: z.enum(["pending", "cleared"]),
    valor_realizado: z.number().int().optional().nullable(),
    recurrence: recurrenceSchema.optional().nullable(),
  })
  .refine(
    (d) => d.type !== "transfer" || (!!d.to_account_id && d.to_account_id !== d.account_id),
    { message: "Escolha uma conta de destino diferente da origem", path: ["to_account_id"] },
  )
  .refine(
    (d) => !d.recurrence || d.type === "income" || d.type === "expense",
    { message: "Recorrência só é permitida para receitas e despesas", path: ["recurrence"] },
  );

export type TransactionInput = z.infer<typeof transactionSchema>;
export { recurrenceSchema };
