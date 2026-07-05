import { z } from "zod";

export const investmentSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(80),
  type: z.string().trim().min(1, "Informe o tipo").max(40),
  current_value_cents: z.number().int().nonnegative("Valor inválido"),
});
export type InvestmentInput = z.infer<typeof investmentSchema>;

export const investmentEntrySchema = z.object({
  investment_id: z.string().uuid(),
  amount_cents: z.number().int().positive("Informe um valor"),
  type: z.enum(["deposit", "withdraw"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  note: z.string().trim().max(200).optional().nullable(),
});
export type InvestmentEntryInput = z.infer<typeof investmentEntrySchema>;
