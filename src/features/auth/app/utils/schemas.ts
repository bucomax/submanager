import { z } from "zod";

import { zodApiMsg } from "@/lib/api/zod-i18n";
import { portalPasswordSchema } from "@/lib/validators/patient-portal-auth";

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Informe a senha"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Email inválido"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token é obrigatório"),
  newPassword: portalPasswordSchema,
});

export const adminInviteSchema = z.object({
  email: z.string().email("Email inválido"),
  name: z.string().max(120).optional(),
  tenantId: z.string().cuid(),
  role: z.enum(["tenant_admin", "tenant_user"]),
});

/** Formulário client (convite / reset); `token` vem da URL. Mesmas regras do portal (senha forte). */
export const setPasswordFormSchema = z
  .object({
    newPassword: portalPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: zodApiMsg("errors.validationPortalPasswordMismatch"),
    path: ["confirmPassword"],
  });

/** Body do endpoint admin para definir senha de convidado pendente. */
export const adminSetInviteePasswordSchema = z.object({
  userId: z.string().cuid(),
  tenantId: z.string().cuid(),
  password: portalPasswordSchema,
});
