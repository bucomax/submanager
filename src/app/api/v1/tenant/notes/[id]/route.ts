import { actorFromSession } from "@/lib/auth/actor";
import { withTenantRoute } from "@/lib/api/route-handler";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { loadConversationVisibilityWhere } from "@/application/use-cases/shared/load-client-visibility-scope";
import { leadNotePrismaRepository } from "@/infrastructure/repositories/lead-note.repository";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { upsertLeadNoteBodySchema } from "@/lib/validators/contacts";
import type { LeadNoteColor, LeadNoteDto } from "@/types/api/contacts-v1";

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

export const PATCH = withTenantRoute<{ id: string }>(async ({ request, session, tenantId, apiT, params }) => {
  const { id } = params;

  const parsed = await parseJsonBody(request, upsertLeadNoteBodySchema.partial(), apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const visibility = await loadConversationVisibilityWhere(actorFromSession(session), tenantId);
  const row = await leadNotePrismaRepository.update(tenantId, id, parsed.data, visibility);
  if (!row) {
    return jsonError("NOT_FOUND", apiT("errors.leadNoteNotFound"), 404);
  }

  return jsonSuccess(toDto(row));
});

export const DELETE = withTenantRoute<{ id: string }>(async ({ session, tenantId, apiT, params }) => {
  const { id } = params;

  const visibility = await loadConversationVisibilityWhere(actorFromSession(session), tenantId);
  const removed = await leadNotePrismaRepository.remove(tenantId, id, visibility);
  if (!removed) {
    return jsonError("NOT_FOUND", apiT("errors.leadNoteNotFound"), 404);
  }

  return jsonSuccess({ id });
});
