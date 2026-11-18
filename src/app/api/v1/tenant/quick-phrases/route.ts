import { withTenantRoute } from "@/lib/api/route-handler";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import {
  isUniqueConstraintError,
  quickPhrasePrismaRepository,
} from "@/infrastructure/repositories/quick-phrase.repository";
import { jsonError, jsonSuccess } from "@/lib/api-response";
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
export const GET = withTenantRoute(async ({ tenantId }) => {
  const rows = await quickPhrasePrismaRepository.listByTenant(tenantId);
  const payload: QuickPhrasesResponseData = { data: rows.map(toDto) };
  return jsonSuccess(payload);
});

export const POST = withTenantRoute(async ({ request, session, tenantId, apiT }) => {
  const parsed = await parseJsonBody(request, upsertQuickPhraseBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  try {
    const row = await quickPhrasePrismaRepository.create(
      tenantId,
      session.user.id,
      parsed.data,
    );
    return jsonSuccess(toDto(row), { status: 201 });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return jsonError("SLUG_TAKEN", apiT("errors.quickPhraseSlugConflict"), 409);
    }
    throw err;
  }
});
