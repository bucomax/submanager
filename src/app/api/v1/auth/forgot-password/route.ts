import { formatZodIssues } from "@/lib/api/zod-error";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { forgotPasswordSchema } from "@/lib/validators/auth";
import { runForgotPassword } from "@/application/use-cases/auth/forgot-password";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { rateLimit } = await import("@/lib/api/rate-limit");
  const limited = await rateLimit("auth");
  if (limited) return limited;

  const apiT = await getApiT(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }

  const result = await runForgotPassword(parsed.data.email);

  if (!result.ok) {
    if (result.code === "EMAIL_NOT_CONFIGURED") {
      return jsonError("SERVICE_UNAVAILABLE", apiT("errors.passwordResetNotConfigured"), 503);
    }
    return jsonError("EMAIL_SEND_FAILED", apiT("errors.emailSendFailedGeneric"), 500);
  }

  return jsonSuccess({
    message: apiT(result.messageKey as "success.forgotPasswordHint"),
  });
}
