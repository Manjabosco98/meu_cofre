import { z } from "zod";

export const accountSchema = z.object({
  // "name" guarda o apelido/rótulo (o cliente garante não vazio; senão usa banco + titularidade).
  name: z.string().trim().min(1, "Informe o apelido").max(80),
  type: z.enum(["checking", "savings", "cash", "credit_card", "investment"]),
  institution: z.string().trim().min(1, "Selecione o banco").max(80),
  titularidade: z.enum(["PF", "PJ"]),
  agencia: z.string().trim().max(20).optional().nullable(),
  numero_conta: z.string().trim().max(30).optional().nullable(),
  initial_balance_cents: z.number().int(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida")
    .default("#6366f1"),
  icon: z.string().default("wallet"),
  archived: z.boolean().default(false),
});

export type AccountInput = z.infer<typeof accountSchema>;
