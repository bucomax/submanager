import { formatZodIssues } from "@/lib/api/zod-error";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { requireSessionOr401, superAdminOr403 } from "@/lib/auth/guards";
import { updateAppBodySchema, publishAppBodySchema } from "@/lib/validators/app";
import { runUpdateApp } from "@/application/use-cases/admin/apps/update-app";
import { runDeleteApp } from "@/application/use-cases/admin/apps/delete-app";
import { runPublishApp } from "@/application/use-cases/admin/apps/publish-app";
import { mapAppToDto } from "@/application/use-cases/admin/apps/map-app-dto";
import { appPrismaRepository } from "@/infrastructure/repositories/app.repository";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ appId: string }> };

/** Detalhe de um app (apenas super_admin). */
export async function GET(request: Request, context: RouteContext) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const forbidden = await superAdminOr403(auth.session!, request, apiT);
  if (forbidden) return forbidden;

  const { appId } = await context.params;
  const app = await appPrismaRepository.findById(appId);
  if (!app) return jsonError("NOT_FOUND", "App não encontrado.", 404);

  return jsonSuccess({ app: mapAppToDto(app) });
}

/** Atualiza dados de um app (apenas super_admin). */
export async function PATCH(request: Request, context: RouteContext) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const forbidden = await superAdminOr403(auth.session!, request, apiT);
  if (forbidden) return forbidden;

  const { appId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

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
}

/** Remove um app do catálogo (apenas super_admin). */
export async function DELETE(request: Request, context: RouteContext) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const forbidden = await superAdminOr403(auth.session!, request, apiT);
  if (forbidden) return forbidden;

  const { appId } = await context.params;
  const result = await runDeleteApp(appId);

  if (!result.ok) {
    return jsonError(
      "CONFLICT",
      "Não é possível excluir um app que possui ativações em tenants. Desative primeiro.",
      409,
    );
  }

  return jsonSuccess({ deleted: true });
}
