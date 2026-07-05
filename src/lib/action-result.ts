import type { ZodError } from "zod";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Primeira mensagem de erro de um ZodError (para exibir no form). */
export function firstZodError(error: ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos";
}
