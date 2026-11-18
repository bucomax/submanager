import { withTenantRoute } from "@/lib/api/route-handler";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import {
  isUniqueConstraintError,
  quickPhrasePrismaRepository,
} from "@/infrastructure/repositories/quick-phrase.repository";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { upsertQuickPhraseBodySchema } from "@/lib/validators/contacts";
import type { QuickPhraseDto } from "@/types/api/contacts-v1";

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

export const PATCH = withTenantRoute<{ id: string }>(async ({ request, tenantId, apiT, params }) => {
  const { id } = params;

  const parsed = await parseJsonBody(request, upsertQuickPhraseBodySchema.partial(), apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  try {
    const row = await quickPhrasePrismaRepository.update(tenantId, id, parsed.data);
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
});

export const DELETE = withTenantRoute<{ id: string }>(async ({ tenantId, apiT, params }) => {
  const { id } = params;

  const removed = await quickPhrasePrismaRepository.remove(tenantId, id);
  if (!removed) {
    return jsonError("NOT_FOUND", apiT("errors.quickPhraseNotFound"), 404);
  }

  return jsonSuccess({ id });
});
