import { mapUseCaseError } from "@/lib/api/map-use-case-error";
import { RESET_PASSWORD_ERRORS } from "@/lib/api/error-tables/auth";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { getApiT } from "@/lib/api/i18n";
import { jsonSuccess } from "@/lib/api-response";
import { resetPasswordSchema } from "@/lib/validators/auth";
import { runResetPasswordWithToken } from "@/application/use-cases/auth/reset-password-with-token";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { rateLimit } = await import("@/lib/api/rate-limit");
  const limited = await rateLimit("auth");
  if (limited) return limited;

  const apiT = await getApiT(request);
  const parsed = await parseJsonBody(request, resetPasswordSchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const { token, newPassword } = parsed.data;

  const result = await runResetPasswordWithToken({ token, newPassword });

  if (!result.ok) {
    return mapUseCaseError(result.code, RESET_PASSWORD_ERRORS, apiT);
  }

  return jsonSuccess({
    message: apiT("success.passwordResetDone"),
  });
}
