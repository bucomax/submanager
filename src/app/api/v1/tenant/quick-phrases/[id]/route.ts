import {
  isUniqueConstraintError,
  quickPhrasePrismaRepository,
} from "@/infrastructure/repositories/quick-phrase.repository";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import {
  assertActiveTenantMembership,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { upsertQuickPhraseBodySchema } from "@/lib/validators/contacts";
import type { QuickPhraseDto } from "@/types/api/contacts-v1";
import type { RouteCtx } from "@/types/api/route-context";

export const dynamic = "force-dynamic";

function toDto(row: {
  id: string;
  slug: string;
  title: string;
  body: string;
  attachment: string | null;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}): QuickPhraseDto {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    body: row.body,
    attachment: row.attachment,
    usageCount: row.usageCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
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

  const parsed = upsertQuickPhraseBodySchema.partial().safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", parsed.error.flatten().formErrors.join("; "), 422);
  }

  try {
    const row = await quickPhrasePrismaRepository.update(tenantCtx.tenantId!, id, parsed.data);
    if (!row) {
      return jsonError("NOT_FOUND", apiT("errors.quickPhraseNotFound"), 404);
    }
    return jsonSuccess(toDto(row));
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return jsonError("SLUG_TAKEN", apiT("errors.quickPhraseSlugConflict"), 409);
    }
    throw err;
  }
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

  const removed = await quickPhrasePrismaRepository.remove(tenantCtx.tenantId!, id);
  if (!removed) {
    return jsonError("NOT_FOUND", apiT("errors.quickPhraseNotFound"), 404);
  }

  return jsonSuccess({ id });
}
