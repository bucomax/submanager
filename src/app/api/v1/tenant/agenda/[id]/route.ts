import { agendaEventPrismaRepository } from "@/infrastructure/repositories/agenda-event.repository";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import {
  assertActiveTenantMembership,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { updateAgendaEventBodySchema } from "@/lib/validators/agenda";
import type { AgendaEventDto, AgendaEventType } from "@/types/api/agenda-v1";
import type { RouteCtx } from "@/types/api/route-context";

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

export async function PATCH(request: Request, ctx: RouteCtx<{ id: string }>) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;

  const memberErr = await assertActiveTenantMembership(auth.session!, tenantCtx.tenantId!, request, apiT);
  if (memberErr) return memberErr;

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = updateAgendaEventBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", parsed.error.flatten().formErrors.join("; "), 422);
  }

  const { startsAt, ...rest } = parsed.data;
  const parsedStartsAt = startsAt ? new Date(startsAt) : undefined;
  if (startsAt && parsedStartsAt && Number.isNaN(parsedStartsAt.getTime())) {
    return jsonError("VALIDATION_ERROR", apiT("errors.agendaRangeRequired"), 422);
  }

  const row = await agendaEventPrismaRepository.update(tenantCtx.tenantId!, id, {
    ...rest,
    ...(parsedStartsAt ? { startsAt: parsedStartsAt } : {}),
  });
  if (!row) {
    return jsonError("NOT_FOUND", apiT("errors.agendaEventNotFound"), 404);
  }

  return jsonSuccess(toDto(row));
}

export async function DELETE(request: Request, ctx: RouteCtx<{ id: string }>) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;

  const memberErr = await assertActiveTenantMembership(auth.session!, tenantCtx.tenantId!, request, apiT);
  if (memberErr) return memberErr;

  const { id } = await ctx.params;

  const removed = await agendaEventPrismaRepository.remove(tenantCtx.tenantId!, id);
  if (!removed) {
    return jsonError("NOT_FOUND", apiT("errors.agendaEventNotFound"), 404);
  }

  return jsonSuccess({ id });
}
