import { z } from "zod";

import { ALLOWED_SMTP_PORTS, isAllowedSmtpPort } from "@/lib/constants/smtp";

const emailSchema = z.string().email().max(254).transform((s) => s.toLowerCase().trim());

/**
 * Atualiza SMTP do tenant. Senha: omita ou string vazia para manter a anterior.
 */
export const patchTenantSmtpBodySchema = z
  .object({
    smtpEnabled: z.boolean().optional(),
    smtpHost: z.union([z.string().max(254), z.literal("")]).optional(),
    smtpPort: z.coerce
      .number()
      .int()
      .refine(isAllowedSmtpPort, { message: `Porta SMTP deve ser uma de: ${ALLOWED_SMTP_PORTS.join(", ")}` })
      .optional(),
    smtpSecure: z.boolean().optional(),
    smtpUser: z.union([z.string().max(254), z.literal("")]).optional(),
    smtpPassword: z.string().max(2000).optional(),
    smtpFromName: z.union([z.string().min(1).max(120), z.literal("")]).optional(),
    smtpFromAddress: z.union([emailSchema, z.literal("")]).optional(),
  })
  .refine(
    (o) =>
      o.smtpEnabled !== undefined ||
      o.smtpHost !== undefined ||
      o.smtpPort !== undefined ||
      o.smtpSecure !== undefined ||
      o.smtpUser !== undefined ||
      o.smtpPassword !== undefined ||
      o.smtpFromName !== undefined ||
      o.smtpFromAddress !== undefined,
    { message: "Informe ao menos um campo" },
  );

export type PatchTenantSmtpBody = z.infer<typeof patchTenantSmtpBodySchema>;

export const postTestTenantSmtpBodySchema = z
  .object({
    to: z.string().email().max(254).optional(),
  })
  .strict();

export type PostTestTenantSmtpBody = z.infer<typeof postTestTenantSmtpBodySchema>;
