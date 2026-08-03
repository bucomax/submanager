import { randomBytes } from "crypto";

import { userPrismaRepository } from "@/infrastructure/repositories/user.repository";
import { getResetPasswordHtml } from "@/infrastructure/email/email-templates";
import { isEmailConfigured, sendEmail, buildResetPasswordUrl } from "@/infrastructure/email/resend.client";
import { normalizeEmail } from "@/lib/utils/email";

export type ForgotPasswordResult =
  | { ok: true; messageKey: "success.forgotPasswordHint" }
  | { ok: false; code: "EMAIL_NOT_CONFIGURED" | "EMAIL_SEND_FAILED" };

/**
 * Solicita reset de senha (token + e-mail). Resposta genérica se usuário não existe (anti-enumeração).
 */
export async function runForgotPassword(emailRaw: string): Promise<ForgotPasswordResult> {
  if (!isEmailConfigured()) {
    return { ok: false, code: "EMAIL_NOT_CONFIGURED" };
  }

  const email = normalizeEmail(emailRaw);

  const user = await userPrismaRepository.findActiveUserForPasswordReset(email);

  if (!user?.passwordHash) {
    return { ok: true, messageKey: "success.forgotPasswordHint" };
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await userPrismaRepository.createPasswordResetToken({
    token,
    userId: user.id,
    expiresAt,
  });

  const resetUrl = buildResetPasswordUrl(token);
  const { error } = await sendEmail({
    to: user.email,
    subject: "SubManager — Redefinir senha",
    html: getResetPasswordHtml({ name: user.name, resetUrl }),
  });

  if (error) {
    console.error("Erro ao enviar email de recuperação:", error);
    return { ok: false, code: "EMAIL_SEND_FAILED" };
  }

  return { ok: true, messageKey: "success.forgotPasswordHint" };
}
