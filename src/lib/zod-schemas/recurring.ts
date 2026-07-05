import { z } from "zod";

export const recurringSchema = z
  .object({
    type: z.enum(["income", "expense"]),
    description: z.string().trim().min(1, "Informe a descrição").max(120),
    amount_cents: z.number().int().positive("Informe um valor"),
    account_id: z.string().uuid("Selecione a conta"),
    category_id: z.string().uuid().optional().nullable(),
    frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
    interval: z.number().int().min(1).max(365),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
    end_type: z.enum(["never", "date", "count"]),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    occurrences: z.number().int().min(1).max(600).optional().nullable(),
  })
  .refine((d) => d.end_type !== "date" || !!d.end_date, {
    message: "Informe a data final",
    path: ["end_date"],
  })
  .refine((d) => d.end_type !== "count" || !!d.occurrences, {
    message: "Informe o nº de repetições",
    path: ["occurrences"],
  });

export type RecurringInput = z.infer<typeof recurringSchema>;
