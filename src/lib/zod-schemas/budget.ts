import { z } from "zod";

export const budgetSchema = z.object({
  category_id: z.string().uuid("Selecione a categoria"),
  month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Mês inválido"),
  limit_cents: z.number().int().positive("Informe um valor"),
});

export type BudgetInput = z.infer<typeof budgetSchema>;
