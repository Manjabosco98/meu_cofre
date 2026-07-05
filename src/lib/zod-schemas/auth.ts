import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Informe seu nome"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres"),
});

export const recoverSchema = z.object({
  email: z.string().email("E-mail inválido"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RecoverInput = z.infer<typeof recoverSchema>;
