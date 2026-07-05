import { z } from "zod";

export const goalSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(80),
  target_cents: z.number().int().positive("Informe o valor-alvo"),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida").default("#22c55e"),
  // Novos campos — caixinhas
  recurring_contribution_cents: z.number().int().nonnegative().optional().nullable(),
  contribution_frequency: z.enum(["monthly", "fortnightly", "weekly", "custom"]).optional().nullable(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  account_id: z.string().uuid().optional().nullable(),
});
export type GoalInput = z.infer<typeof goalSchema>;

export const contributionSchema = z.object({
  goal_id: z.string().uuid(),
  amount_cents: z.number().int().refine((v) => v !== 0, "Informe um valor"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  note: z.string().trim().max(200).optional().nullable(),
  type: z.enum(["contribution", "withdrawal"]).default("contribution"),
});
export type ContributionInput = z.infer<typeof contributionSchema>;

export const FREQUENCY_OPTIONS = [
  { value: "monthly", label: "Mensal" },
  { value: "fortnightly", label: "Quinzenal" },
  { value: "weekly", label: "Semanal" },
  { value: "custom", label: "Personalizada" },
] as const;
