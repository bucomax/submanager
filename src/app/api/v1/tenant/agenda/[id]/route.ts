import { actorFromSession } from "@/lib/auth/actor";
import { withTenantRoute } from "@/lib/api/route-handler";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { loadAgendaEventVisibilityWhere } from "@/application/use-cases/shared/load-client-visibility-scope";
import { validateAgendaEventRefs } from "@/application/use-cases/agenda/validate-agenda-event-references";
import { agendaEventPrismaRepository } from "@/infrastructure/repositories/agenda-event.repository";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { updateAgendaEventBodySchema } from "@/lib/validators/agenda";
import type { AgendaEventDto, AgendaEventType } from "@/types/api/agenda-v1";
import { agendaRefsErrorResponse } from "../agenda-refs-error-response";

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

export const PATCH = withTenantRoute<{ id: string }>(async ({ request, session, tenantId, apiT, params }) => {
  const { id } = params;

  const parsed = await parseJsonBody(request, updateAgendaEventBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const { startsAt, ...rest } = parsed.data;
  const parsedStartsAt = startsAt ? new Date(startsAt) : undefined;
  if (startsAt && parsedStartsAt && Number.isNaN(parsedStartsAt.getTime())) {
    return jsonError("VALIDATION_ERROR", apiT("errors.agendaRangeRequired"), 422);
  }

  const refsErr = await validateAgendaEventRefs(actorFromSession(session),
    tenantId,
    {
      conversationId: rest.conversationId,
      clientId: rest.clientId,
      ownerUserId: rest.ownerUserId,
    },
  );
  if (refsErr) return agendaRefsErrorResponse(refsErr, apiT);

  const visibility = await loadAgendaEventVisibilityWhere(actorFromSession(session), tenantId);
  const row = await agendaEventPrismaRepository.update(
    tenantId,
    id,
    {
      ...rest,
      ...(parsedStartsAt ? { startsAt: parsedStartsAt } : {}),
    },
    visibility,
  );
  if (!row) {
    return jsonError("NOT_FOUND", apiT("errors.agendaEventNotFound"), 404);
  }

  return jsonSuccess(toDto(row));
});

export const DELETE = withTenantRoute<{ id: string }>(async ({ session, tenantId, apiT, params }) => {
  const { id } = params;

  const visibility = await loadAgendaEventVisibilityWhere(actorFromSession(session), tenantId);
  const removed = await agendaEventPrismaRepository.remove(tenantId, id, visibility);
  if (!removed) {
    return jsonError("NOT_FOUND", apiT("errors.agendaEventNotFound"), 404);
  }

  return jsonSuccess({ id });
});
