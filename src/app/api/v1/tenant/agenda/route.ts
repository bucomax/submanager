import { actorFromSession } from "@/lib/auth/actor";
import { withTenantRoute } from "@/lib/api/route-handler";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { validateAgendaEventRefs } from "@/application/use-cases/agenda/validate-agenda-event-references";
import {
  loadAgendaEventVisibilityWhere,
  loadConversationVisibilityWhere,
} from "@/application/use-cases/shared/load-client-visibility-scope";
import { sendConversationMessage } from "@/application/use-cases/conversations/send-conversation-message";
import { agendaEventPrismaRepository } from "@/infrastructure/repositories/agenda-event.repository";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { createAgendaEventBodySchema } from "@/lib/validators/agenda";
import type { AgendaEventDto, AgendaEventType, AgendaListResponseData } from "@/types/api/agenda-v1";
import { EVENT_TYPE_LABEL_PT_BR } from "@/lib/constants/agenda";
import { agendaRefsErrorResponse } from "./agenda-refs-error-response";

export const dynamic = "force-dynamic";

function toDto(row: {
  id: string;
  conversationId: string | null;
  clientId: string | null;
  title: string;
  type: string;
  startsAt: Date;
  durationMin: number;
  ownerUserId: string;
  owner: { name: string | null };
  conversation: { displayName: string } | null;
  notes: string | null;
  createdAt: Date;
}): AgendaEventDto {
  return {
    id: row.id,
    conversationId: row.conversationId,
    clientId: row.clientId,
    title: row.title,
    type: row.type as AgendaEventType,
    startsAt: row.startsAt.toISOString(),
    durationMin: row.durationMin,
    ownerUserId: row.ownerUserId,
    ownerUserName: row.owner.name,
    leadName: row.conversation?.displayName ?? null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

/** dd/mm/aaaa às HH:MM em horário local do processo (America/Sao_Paulo em produção). */
function formatConfirmationDateTime(date: Date): { date: string; time: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

/** Compromissos do tenant num intervalo — usado pelas grades de Semana/Mês. */
export const GET = withTenantRoute(async ({ request, session, tenantId, apiT }) => {
  const url = new URL(request.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const from = fromParam ? new Date(fromParam) : null;
  const to = toParam ? new Date(toParam) : null;

  if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return jsonError("VALIDATION_ERROR", apiT("errors.agendaRangeRequired"), 400);
  }

  const visibility = await loadAgendaEventVisibilityWhere(actorFromSession(session), tenantId);
  const rows = await agendaEventPrismaRepository.listByRange(tenantId, from, to, visibility);
  const payload: AgendaListResponseData = { data: rows.map(toDto) };
  return jsonSuccess(payload);
});

export const POST = withTenantRoute(async ({ request, session, tenantId, apiT }) => {
  const parsed = await parseJsonBody(request, createAgendaEventBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const startsAt = new Date(parsed.data.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    return jsonError("VALIDATION_ERROR", apiT("errors.agendaRangeRequired"), 422);
  }

  const refsErr = await validateAgendaEventRefs(actorFromSession(session),
    tenantId,
    {
      conversationId: parsed.data.conversationId,
      clientId: parsed.data.clientId,
      ownerUserId: parsed.data.ownerUserId,
    },
  );
  if (refsErr) return agendaRefsErrorResponse(refsErr, apiT);

  const row = await agendaEventPrismaRepository.create(tenantId, {
    conversationId: parsed.data.conversationId,
    clientId: parsed.data.clientId,
    title: parsed.data.title,
    type: parsed.data.type,
    startsAt,
    durationMin: parsed.data.durationMin,
    ownerUserId: parsed.data.ownerUserId,
    notes: parsed.data.notes,
  });

  if (parsed.data.sendConfirmation && row.conversationId) {
    const { date, time } = formatConfirmationDateTime(startsAt);
    const typeLabel = EVENT_TYPE_LABEL_PT_BR[row.type as AgendaEventType] ?? row.title;
    const confirmationText = `Agendamento confirmado: ${row.title} (${typeLabel}) em ${date} às ${time} com ${row.owner.name ?? "nossa equipe"}. Chegue 15 minutos antes 🙂`;
    await sendConversationMessage({
      tenantId,
      conversationId: row.conversationId,
      actorUserId: session.user.id,
      body: confirmationText,
      visibility: await loadConversationVisibilityWhere(actorFromSession(session), tenantId),
    });
  }

  return jsonSuccess(toDto(row), { status: 201 });
});
