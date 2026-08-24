import * as Sentry from "@sentry/nextjs";
import { toFeedbackDto } from "@/app/api/v1/feedback/to-feedback-dto";
import { feedbackReportPrismaRepository } from "@/infrastructure/repositories/feedback-report.repository";
import { formatZodIssues } from "@/lib/api/zod-error";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import {
  assertActiveTenantMembership,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { redactSensitiveText } from "@/lib/observability/sentry-scrubber";
import { createFeedbackBodySchema } from "@/lib/validators/feedback";
import type { CreateFeedbackResponseData } from "@/types/api/feedback-v1";

export const dynamic = "force-dynamic";

/** Relato de feedback do usuário autenticado — sugestão, problema ou dúvida. */
export async function POST(request: Request) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;

  const memberErr = await assertActiveTenantMembership(
    auth.session!,
    tenantCtx.tenantId!,
    request,
    apiT,
  );
  if (memberErr) return memberErr;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = createFeedbackBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }

  const row = await feedbackReportPrismaRepository.create({
    tenantId: tenantCtx.tenantId!,
    authorUserId: auth.session!.user.id,
    type: parsed.data.type,
    message: parsed.data.message,
    sentryEventId: parsed.data.sentryEventId ?? null,
    requestId: parsed.data.requestId ?? null,
    pagePath: parsed.data.pagePath,
    userAgent: request.headers.get("user-agent"),
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? null,
    locale: parsed.data.locale,
  });

  mirrorToSentry(row.type, row.sentryEventId, row.message);

  const payload: CreateFeedbackResponseData = { feedback: toFeedbackDto(row) };
  return jsonSuccess(payload, { status: 201 });
}

/**
 * Espelho no Sentry, fora do caminho crítico: o Postgres é a fonte de verdade e
 * indisponibilidade do Sentry não pode derrubar o relato do usuário.
 */
function mirrorToSentry(type: string, sentryEventId: string | null, message: string) {
  if (type !== "bug" || !sentryEventId) return;
  try {
    // `Sentry.captureFeedback` monta um evento `type: "feedback"`, e `beforeSend`
    // só roda para evento de erro (`type` ausente) — `scrubSentryEvent` nunca vê
    // este payload. Por isso a redação é manual aqui, e só nesta cópia: o `message`
    // gravado no Postgres pelo `create` acima continua íntegro, porque é a fonte
    // de verdade que o triador lê e nunca sai do banco do próprio tenant.
    Sentry.captureFeedback({
      associatedEventId: sentryEventId,
      message: redactSensitiveText(message),
    });
  } catch {
    // silêncio proposital — ver comentário acima
  }
}
