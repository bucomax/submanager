import { withTenantRoute } from "@/lib/api/route-handler";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import * as Sentry from "@sentry/nextjs";
import { toFeedbackDto } from "@/app/api/v1/feedback/to-feedback-dto";
import { feedbackReportPrismaRepository } from "@/infrastructure/repositories/feedback-report.repository";
import { jsonSuccess } from "@/lib/api-response";
import { createFeedbackBodySchema } from "@/lib/validators/feedback";
import type { CreateFeedbackResponseData } from "@/types/api/feedback-v1";

export const dynamic = "force-dynamic";

/** Relato de feedback do usuário autenticado — sugestão, problema ou dúvida. */
export const POST = withTenantRoute(async ({ request, session, tenantId, apiT }) => {
  const parsed = await parseJsonBody(request, createFeedbackBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const row = await feedbackReportPrismaRepository.create({
    tenantId,
    authorUserId: session.user.id,
    type: parsed.data.type,
    message: parsed.data.message,
    sentryEventId: parsed.data.sentryEventId ?? null,
    requestId: parsed.data.requestId ?? null,
    pagePath: parsed.data.pagePath,
    userAgent: request.headers.get("user-agent"),
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? null,
    locale: parsed.data.locale,
  });

  mirrorToSentry(row.type, row.sentryEventId, row.id);

  const payload: CreateFeedbackResponseData = { feedback: toFeedbackDto(row) };
  return jsonSuccess(payload, { status: 201 });
});

/**
 * Espelho no Sentry, fora do caminho crítico: o Postgres é a fonte de verdade e
 * indisponibilidade do Sentry não pode derrubar o relato do usuário.
 */
function mirrorToSentry(type: string, sentryEventId: string | null, feedbackId: string) {
  if (type !== "bug" || !sentryEventId) return;
  try {
    // O texto livre do relato nunca sai do Postgres: neste domínio clínico ele
    // costuma citar o nome do paciente, e nome é o único identificador que
    // nenhuma regex de `redactSensitiveText` consegue remover com segurança.
    // O evento no Sentry vira só um ponteiro — basta pra ligar o erro ao relato,
    // e o texto completo já está em Configurações › Feedback pra quem for triar.
    Sentry.captureFeedback({
      associatedEventId: sentryEventId,
      message: `Relato registrado no painel: ${feedbackId}`,
    });
  } catch {
    // silêncio proposital — ver comentário acima
  }
}
