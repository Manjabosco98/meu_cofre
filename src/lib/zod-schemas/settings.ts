import { z } from "zod";

export const profileSettingsSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome").max(80),
  avatar_url: z.string().trim().url("URL invalida").max(500).optional().nullable().or(z.literal("")),
  currency: z.enum(["BRL"]),
  timezone: z.enum(["America/Sao_Paulo"]),
  theme: z.enum(["system", "light", "dark"]),
});

export type ProfileSettingsInput = z.infer<typeof profileSettingsSchema>;
