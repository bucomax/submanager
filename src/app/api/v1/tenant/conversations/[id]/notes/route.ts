import { actorFromSession } from "@/lib/auth/actor";
import { withTenantRoute } from "@/lib/api/route-handler";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { loadConversationVisibilityWhere } from "@/application/use-cases/shared/load-client-visibility-scope";
import { conversationPrismaRepository } from "@/infrastructure/repositories/conversation.repository";
import { leadNotePrismaRepository } from "@/infrastructure/repositories/lead-note.repository";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { upsertLeadNoteBodySchema } from "@/lib/validators/contacts";
import type { LeadNoteColor, LeadNoteDto, LeadNotesResponseData } from "@/types/api/contacts-v1";

export const dynamic = "force-dynamic";

function toDto(row: {
  id: string;
  conversationId: string;
  authorId: string;
  author: { name: string | null };
  text: string;
  color: string;
  pinned: boolean;
  editedAt: Date | null;
  createdAt: Date;
}): LeadNoteDto {
  return {
    id: row.id,
    conversationId: row.conversationId,
    authorId: row.authorId,
    authorName: row.author.name,
    text: row.text,
    color: row.color as LeadNoteColor,
    pinned: row.pinned,
    editedAt: row.editedAt ? row.editedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Notas internas de um lead (nunca enviadas ao contato). */
export const GET = withTenantRoute<{ id: string }>(async ({ session, tenantId, params }) => {
  const { id } = params;

  const visibility = await loadConversationVisibilityWhere(actorFromSession(session), tenantId);
  const rows = await leadNotePrismaRepository.listByConversation(tenantId, id, visibility);
  const payload: LeadNotesResponseData = { data: rows.map(toDto) };
  return jsonSuccess(payload);
});

export const POST = withTenantRoute<{ id: string }>(async ({ request, session, tenantId, apiT, params }) => {
  const { id } = params;

  const parsed = await parseJsonBody(request, upsertLeadNoteBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const visibility = await loadConversationVisibilityWhere(actorFromSession(session), tenantId);
  const conversation = await conversationPrismaRepository.findVisibleLink(tenantId, id, visibility);
  if (!conversation) {
    return jsonError("NOT_FOUND", apiT("errors.conversationNotFound"), 404);
  }

  const row = await leadNotePrismaRepository.create(
    tenantId,
    id,
    session.user.id,
    parsed.data,
    conversation.clientId,
  );

  return jsonSuccess(toDto(row), { status: 201 });
});
