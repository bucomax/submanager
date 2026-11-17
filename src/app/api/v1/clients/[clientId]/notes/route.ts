import { formatZodIssues } from "@/lib/api/zod-error";
import { buildPagination } from "@/lib/api/pagination";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { createClientNote } from "@/application/use-cases/client/create-client-note";
import { listClientNotesPage } from "@/application/use-cases/client/list-client-notes-page";
import { findTenantClientVisibleToSession } from "@/application/use-cases/shared/load-client-visibility-scope";
import {
  assertActiveTenantMembership,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { postClientNoteBodySchema } from "@/lib/validators/client-note";
import { clientDetailQuerySchema } from "@/lib/validators/client-detail-query";
import type { Session } from "next-auth";
import type { RouteCtx } from "@/types/api/route-context";

export const dynamic = "force-dynamic";

async function ensureClientVisible(session: Session, clientId: string, tenantId: string) {
  return findTenantClientVisibleToSession(session, tenantId, clientId, { id: true });
}

export async function GET(request: Request, ctx: RouteCtx) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;

  const forbidden = await assertActiveTenantMembership(auth.session!, tenantCtx.tenantId, request, apiT);
  if (forbidden) return forbidden;

  const url = new URL(request.url);
  const parsedQuery = clientDetailQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsedQuery.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsedQuery.error), 422);
  }

  const { page, limit } = parsedQuery.data;
  const { clientId } = await ctx.params;

  const client = await ensureClientVisible(auth.session!, clientId, tenantCtx.tenantId);
  if (!client) {
    return jsonError("NOT_FOUND", apiT("errors.patientNotFound"), 404);
  }

  const { totalItems, rows } = await listClientNotesPage({
    tenantId: tenantCtx.tenantId,
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
}

export async function POST(request: Request, ctx: RouteCtx) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;

  const forbidden = await assertActiveTenantMembership(auth.session!, tenantCtx.tenantId, request, apiT);
  if (forbidden) return forbidden;

  const { clientId } = await ctx.params;
  const client = await ensureClientVisible(auth.session!, clientId, tenantCtx.tenantId);
  if (!client) {
    return jsonError("NOT_FOUND", apiT("errors.patientNotFound"), 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = postClientNoteBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }

  const note = await createClientNote({
    tenantId: tenantCtx.tenantId,
    clientId,
    authorUserId: auth.session!.user.id,
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
}
