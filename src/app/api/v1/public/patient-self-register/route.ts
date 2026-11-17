import { after } from "next/server";

import { getApiT } from "@/lib/api/i18n";
import { joinTranslatedZodIssues } from "@/lib/api/zod-i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import {
  loadPatientSelfRegisterInvitePreview,
  publicPatientSelfRegisterBodySchema,
  runCompletePatientSelfRegister,
} from "@/application/use-cases/self-register/process-patient-self-register";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { rateLimit } = await import("@/lib/api/rate-limit");
  const limited = await rateLimit("patientPortalPublicIp");
  if (limited) return limited;

  const url = new URL(request.url);
  const token = (url.searchParams.get("token") ?? "").trim();

  const preview = await loadPatientSelfRegisterInvitePreview(request, token);
  if (!preview.valid) {
    return jsonSuccess({ valid: false } satisfies { valid: boolean });
  }

  return jsonSuccess({
    valid: true,
    tenantName: preview.tenantName,
    tenantTaxId: preview.tenantTaxId,
    expiresAt: preview.expiresAt,
    ...(preview.formPrefill ? { formPrefill: preview.formPrefill } : {}),
  });
}

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

  const parsed = publicPatientSelfRegisterBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      joinTranslatedZodIssues(parsed.error, apiT as (key: string) => string),
      422,
    );
  }

  const outcome = await runCompletePatientSelfRegister(request, parsed.data);

  if (!outcome.ok) {
    if (outcome.code === "INVALID_TOKEN") {
      return jsonError(
        "INVALID_TOKEN",
        apiT("errors.patientSelfRegisterInvalidOrExpired"),
        400,
      );
    }
    return jsonError(
      "CONFLICT",
      apiT("errors.patientSelfRegisterInvalidOrExpired"),
      409,
    );
  }

  // E-mails de boas-vindas e aviso à equipe: após a resposta, sem se perder no serverless.
  after(outcome.afterCommit);

  return jsonSuccess({
    message: apiT("success.patientSelfRegistered"),
  });
}
