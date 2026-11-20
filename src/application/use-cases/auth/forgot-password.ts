import { logger } from "@/lib/observability/logger";
import { randomBytes } from "crypto";

import { userPrismaRepository } from "@/infrastructure/repositories/user.repository";
import { getResetPasswordHtml } from "@/infrastructure/email/email-templates";
import { isEmailConfigured, sendEmail, buildResetPasswordUrl } from "@/infrastructure/email/resend.client";
import { normalizeEmail } from "@/lib/utils/email";

export type ForgotPasswordResult =
  | {
      ok: true;
      messageKey: "success.forgotPasswordHint";
      /**
       * Gera o token e envia o e-mail. A rota agenda com `after()`: a resposta (conteúdo e tempo) é a mesma
       * exista a conta ou não, e falha de envio é só logada (nunca vira oráculo de e-mail cadastrado).
       */
      afterResponse: () => Promise<void>;
    }
  | { ok: false; code: "EMAIL_NOT_CONFIGURED" };

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

const noopAfterResponse = async (): Promise<void> => undefined;

type ResetUser = NonNullable<Awaited<ReturnType<typeof userPrismaRepository.findActiveUserForPasswordReset>>>;

async function issueAndSendResetEmail(user: ResetUser): Promise<void> {
  try {
    const token = randomBytes(32).toString("hex");
    await userPrismaRepository.createPasswordResetToken({
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    });

    const { error } = await sendEmail({
      to: user.email,
      subject: "Redefina sua senha do SubManager",
      html: getResetPasswordHtml({ name: user.name, resetUrl: buildResetPasswordUrl(token) }),
    });
    if (error) {
      logger.error("Erro ao enviar email de recuperação", { userId: user.id, err: error });
    }
  } catch (err) {
    logger.error("Erro ao processar recuperação de senha", { userId: user.id, err });
  }
}

/**
 * Solicita reset de senha (token + e-mail). Resposta idêntica exista o usuário ou não, e mesmo se o envio falhar
 * (anti-enumeração); o trabalho caro (token + e-mail) roda em `afterResponse`.
 */
export async function runForgotPassword(emailRaw: string): Promise<ForgotPasswordResult> {
  if (!isEmailConfigured()) {
    return { ok: false, code: "EMAIL_NOT_CONFIGURED" };
  }

  const email = normalizeEmail(emailRaw);
  const user = await userPrismaRepository.findActiveUserForPasswordReset(email);

  const messageKey = "success.forgotPasswordHint" as const;
  if (!user?.passwordHash) {
    return { ok: true, messageKey, afterResponse: noopAfterResponse };
  }

  return { ok: true, messageKey, afterResponse: () => issueAndSendResetEmail(user) };
}
