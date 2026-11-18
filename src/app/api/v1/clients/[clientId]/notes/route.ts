import { actorFromSession } from "@/lib/auth/actor";
import { withTenantRoute } from "@/lib/api/route-handler";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { formatZodIssues } from "@/lib/api/zod-error";
import { buildPagination } from "@/lib/api/pagination";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { createClientNote } from "@/application/use-cases/client/create-client-note";
import { listClientNotesPage } from "@/application/use-cases/client/list-client-notes-page";
import { findTenantClientVisibleToActor } from "@/application/use-cases/shared/load-client-visibility-scope";
import { postClientNoteBodySchema } from "@/lib/validators/client-note";
import { clientDetailQuerySchema } from "@/lib/validators/client-detail-query";
import type { Session } from "next-auth";

export const dynamic = "force-dynamic";

async function ensureClientVisible(session: Session, clientId: string, tenantId: string) {
  return findTenantClientVisibleToActor(actorFromSession(session), tenantId, clientId, { id: true });
}

export const GET = withTenantRoute(async ({ request, session, tenantId, apiT, params }) => {
  const url = new URL(request.url);
  const parsedQuery = clientDetailQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsedQuery.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsedQuery.error), 422);
  }

  const { page, limit } = parsedQuery.data;
  const { clientId } = params;

  const client = await ensureClientVisible(session, clientId, tenantId);
  if (!client) {
    return jsonError("NOT_FOUND", apiT("errors.patientNotFound"), 404);
  }

  const { totalItems, rows } = await listClientNotesPage({
    tenantId,
    clientId,
    page,
    limit,
  });

  return jsonSuccess({
    data: rows.map((row) => ({
      id: row.id,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      author: row.author,
    })),
    pagination: buildPagination(page, limit, totalItems),
  });
});

export const POST = withTenantRoute(async ({ request, session, tenantId, apiT, params }) => {
  const { clientId } = params;
  const client = await ensureClientVisible(session, clientId, tenantId);
  if (!client) {
    return jsonError("NOT_FOUND", apiT("errors.patientNotFound"), 404);
  }

  const parsed = await parseJsonBody(request, postClientNoteBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const note = await createClientNote({
    tenantId,
    clientId,
    authorUserId: session.user.id,
    content: parsed.data.content,
  });

  return jsonSuccess(
    {
      note: {
        id: note.id,
        content: note.content,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
        author: note.author,
      },
    },
    { status: 201 },
  );
});
