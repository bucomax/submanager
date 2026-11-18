import { withSessionRoute } from "@/lib/api/route-handler";
import { readJsonBody } from "@/lib/api/parse-json-body";
import { formatZodIssues } from "@/lib/api/zod-error";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { updateAppBodySchema, publishAppBodySchema } from "@/lib/validators/app";
import { runUpdateApp } from "@/application/use-cases/admin/apps/update-app";
import { runDeleteApp } from "@/application/use-cases/admin/apps/delete-app";
import { runPublishApp } from "@/application/use-cases/admin/apps/publish-app";
import { mapAppToDto } from "@/application/use-cases/admin/apps/map-app-dto";
import { appPrismaRepository } from "@/infrastructure/repositories/app.repository";

export const dynamic = "force-dynamic";

/** Detalhe de um app (apenas super_admin). */
export const GET = withSessionRoute<{ appId: string }>(async ({ apiT, params }) => {
  const { appId } = params;
  const app = await appPrismaRepository.findById(appId);
  if (!app) return jsonError("NOT_FOUND", apiT("errors.appNotFound"), 404);

  return jsonSuccess({ app: mapAppToDto(app) });
}, { role: "super_admin" });

/** Atualiza dados de um app (apenas super_admin). */
export const PATCH = withSessionRoute<{ appId: string }>(async ({ request, apiT, params }) => {
  const { appId } = params;

  const raw = await readJsonBody(request, apiT);
  if (raw.response) return raw.response;
  const body = raw.data;

  // Detecta se é publish/unpublish
  const publishParsed = publishAppBodySchema.safeParse(body);
  if (publishParsed.success && Object.keys(body as object).length === 1) {
    const app = await runPublishApp(appId, publishParsed.data.isPublished);
    return jsonSuccess({ app: mapAppToDto(app) });
  }

  const parsed = updateAppBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }

  const app = await runUpdateApp(appId, parsed.data);
  return jsonSuccess({ app: mapAppToDto(app) });
}, { role: "super_admin" });

/** Remove um app do catálogo (apenas super_admin). */
export const DELETE = withSessionRoute<{ appId: string }>(async ({ apiT, params }) => {
  const { appId } = params;
  const result = await runDeleteApp(appId);

  if (!result.ok) {
    return jsonError("CONFLICT", apiT("errors.appDeleteHasActivations"), 409);
  }

  return jsonSuccess({ deleted: true });
}, { role: "super_admin" });
