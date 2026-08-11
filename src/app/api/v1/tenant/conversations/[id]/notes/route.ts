import { prisma } from "@/infrastructure/database/prisma";
import { leadNotePrismaRepository } from "@/infrastructure/repositories/lead-note.repository";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import {
  assertActiveTenantMembership,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { upsertLeadNoteBodySchema } from "@/lib/validators/contacts";
import type { LeadNoteColor, LeadNoteDto, LeadNotesResponseData } from "@/types/api/contacts-v1";
import type { RouteCtx } from "@/types/api/route-context";

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
export async function GET(request: Request, ctx: RouteCtx<{ id: string }>) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;

  const memberErr = await assertActiveTenantMembership(auth.session!, tenantCtx.tenantId!, request, apiT);
  if (memberErr) return memberErr;

  const { id } = await ctx.params;

  const rows = await leadNotePrismaRepository.listByConversation(tenantCtx.tenantId!, id);
  const payload: LeadNotesResponseData = { data: rows.map(toDto) };
  return jsonSuccess(payload);
}

export async function POST(request: Request, ctx: RouteCtx<{ id: string }>) {
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

  const parsed = upsertLeadNoteBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", parsed.error.flatten().formErrors.join("; "), 422);
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id, tenantId: tenantCtx.tenantId! },
    select: { clientId: true },
  });
  if (!conversation) {
    return jsonError("NOT_FOUND", apiT("errors.conversationNotFound"), 404);
  }

  const row = await leadNotePrismaRepository.create(
    tenantCtx.tenantId!,
    id,
    auth.session!.user.id,
    parsed.data,
    conversation.clientId,
  );

  return jsonSuccess(toDto(row), { status: 201 });
}
