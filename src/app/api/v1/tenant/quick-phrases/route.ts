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
import type { QuickPhraseDto, QuickPhrasesResponseData } from "@/types/api/contacts-v1";

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

/** Frases prontas do tenant — compartilhadas por toda a equipe. */
export async function GET(request: Request) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;

  const memberErr = await assertActiveTenantMembership(auth.session!, tenantCtx.tenantId!, request, apiT);
  if (memberErr) return memberErr;

  const rows = await quickPhrasePrismaRepository.listByTenant(tenantCtx.tenantId!);
  const payload: QuickPhrasesResponseData = { data: rows.map(toDto) };
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

  const parsed = upsertQuickPhraseBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", parsed.error.flatten().formErrors.join("; "), 422);
  }

  try {
    const row = await quickPhrasePrismaRepository.create(
      tenantCtx.tenantId!,
      auth.session!.user.id,
      parsed.data,
    );
    return jsonSuccess(toDto(row), { status: 201 });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return jsonError("SLUG_TAKEN", apiT("errors.quickPhraseSlugConflict"), 409);
    }
    throw err;
  }
}
