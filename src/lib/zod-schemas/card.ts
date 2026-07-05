import { z } from "zod";

export const cardSchema = z.object({
  apelido: z.string().trim().max(60).optional().nullable(),
  institution: z.string().trim().max(60).optional().nullable(),
  brand: z.string().trim().max(30).optional().nullable(),
  last4: z
    .string()
    .regex(/^\d{4}$/, "Use os 4 últimos dígitos")
    .optional()
    .nullable(),
  linked_account_id: z.string().uuid("Conta inválida").optional().nullable(),
  limit_cents: z.number().int().nonnegative(),
  closing_day: z.number().int().min(1).max(31),
  due_day: z.number().int().min(1).max(31),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida").default("#8b5cf6"),
});
export type CardInput = z.infer<typeof cardSchema>;

export const purchaseSchema = z
  .object({
    card_id: z.string().uuid(),
    amount_cents: z.number().int().positive("Informe um valor"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
    description: z.string().trim().min(1, "Informe a descrição").max(120),
    category_id: z.string().uuid().optional().nullable(),
    installments: z.number().int().min(1).max(60),
    // Assinatura recorrente (opcional)
    is_recurring: z.boolean().optional().default(false),
    subscription_frequency: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
    subscription_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    subscription_status: z.enum(["active", "paused", "cancelled"]).optional(),
  })
  .refine((d) => !d.is_recurring || !!d.subscription_frequency, {
    message: "Frequência é obrigatória para assinatura",
    path: ["subscription_frequency"],
  });
export type PurchaseInput = z.infer<typeof purchaseSchema>;

export const subscriptionSchema = z.object({
  id: z.string().uuid(),
  description: z.string().trim().min(1, "Informe a descrição").max(120),
  amount_cents: z.number().int().positive("Informe um valor"),
  category_id: z.string().uuid().optional().nullable(),
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
  interval: z.number().int().min(1).max(365),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  status: z.enum(["active", "paused", "cancelled"]),
});
export type SubscriptionInput = z.infer<typeof subscriptionSchema>;

export const payInvoiceSchema = z.object({
  invoice_id: z.string().uuid(),
  from_account_id: z.string().uuid("Selecione a conta de origem"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  amount_cents: z.number().int().positive("Informe o valor"),
});
export type PayInvoiceInput = z.infer<typeof payInvoiceSchema>;
