import { mapUseCaseError } from "@/lib/api/map-use-case-error";
import { FORGOT_PASSWORD_ERRORS } from "@/lib/api/error-tables/auth";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { getApiT } from "@/lib/api/i18n";
import { jsonSuccess } from "@/lib/api-response";
import { forgotPasswordSchema } from "@/lib/validators/auth";
import { runForgotPassword } from "@/application/use-cases/auth/forgot-password";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { rateLimit } = await import("@/lib/api/rate-limit");
  const limited = await rateLimit("auth");
  if (limited) return limited;

  const apiT = await getApiT(request);

  const parsed = await parseJsonBody(request, forgotPasswordSchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const result = await runForgotPassword(parsed.data.email);

  if (!result.ok) {
    return mapUseCaseError(result.code, FORGOT_PASSWORD_ERRORS, apiT);
  }

  return jsonSuccess({
    message: apiT(result.messageKey as "success.forgotPasswordHint"),
  });
}
