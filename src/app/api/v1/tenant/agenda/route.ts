import { sendConversationMessage } from "@/application/use-cases/conversations/send-conversation-message";
import { agendaEventPrismaRepository } from "@/infrastructure/repositories/agenda-event.repository";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import {
  assertActiveTenantMembership,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { createAgendaEventBodySchema } from "@/lib/validators/agenda";
import type { AgendaEventDto, AgendaEventType, AgendaListResponseData } from "@/types/api/agenda-v1";
import { EVENT_TYPE_LABEL_PT_BR } from "@/lib/constants/agenda";

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
export async function GET(request: Request) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;

  const memberErr = await assertActiveTenantMembership(auth.session!, tenantCtx.tenantId!, request, apiT);
  if (memberErr) return memberErr;

  const url = new URL(request.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const from = fromParam ? new Date(fromParam) : null;
  const to = toParam ? new Date(toParam) : null;

  if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return jsonError("VALIDATION_ERROR", apiT("errors.agendaRangeRequired"), 400);
  }

  const rows = await agendaEventPrismaRepository.listByRange(tenantCtx.tenantId!, from, to);
  const payload: AgendaListResponseData = { data: rows.map(toDto) };
  return jsonSuccess(payload);
}

export async function POST(request: Request) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;

  const memberErr = await assertActiveTenantMembership(auth.session!, tenantCtx.tenantId!, request, apiT);
  if (memberErr) return memberErr;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = createAgendaEventBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", parsed.error.flatten().formErrors.join("; "), 422);
  }

  const startsAt = new Date(parsed.data.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    return jsonError("VALIDATION_ERROR", apiT("errors.agendaRangeRequired"), 422);
  }

  const row = await agendaEventPrismaRepository.create(tenantCtx.tenantId!, {
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
      tenantId: tenantCtx.tenantId!,
      conversationId: row.conversationId,
      actorUserId: auth.session!.user.id,
      body: confirmationText,
    });
  }

  return jsonSuccess(toDto(row), { status: 201 });
}
