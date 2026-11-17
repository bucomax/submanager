import { formatZodIssues } from "@/lib/api/zod-error";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { resetPasswordSchema } from "@/lib/validators/auth";
import { runResetPasswordWithToken } from "@/application/use-cases/auth/reset-password-with-token";

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

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }

  const { token, newPassword } = parsed.data;

  const result = await runResetPasswordWithToken({ token, newPassword });

  if (!result.ok) {
    if (result.code === "TOKEN_EXPIRED") {
      return jsonError("TOKEN_EXPIRED", apiT("errors.linkExpired"), 400);
    }
    if (result.code === "USE_INVITE_FOR_FIRST_PASSWORD") {
      return jsonError("INVALID_TOKEN", apiT("errors.useInviteForFirstPassword"), 400);
    }
    return jsonError("INVALID_TOKEN", apiT("errors.invalidLinkOrUsed"), 400);
  }

  return jsonSuccess({
    message: apiT("success.passwordResetDone"),
  });
}
