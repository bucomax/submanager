import { formatZodIssues } from "@/lib/api/zod-error";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { requireSessionOr401, superAdminOr403 } from "@/lib/auth/guards";
import { createAppBodySchema } from "@/lib/validators/app";
import { listAllApps } from "@/application/use-cases/admin/apps/list-apps";
import { runCreateApp } from "@/application/use-cases/admin/apps/create-app";
import { mapAppToDto } from "@/application/use-cases/admin/apps/map-app-dto";

export const dynamic = "force-dynamic";

/** Lista todos os apps do catálogo (apenas super_admin). */
export async function GET(request: Request) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const forbidden = await superAdminOr403(auth.session!, request, apiT);
  if (forbidden) return forbidden;

  const rows = await listAllApps();
  return jsonSuccess({ apps: rows.map(mapAppToDto) });
}

/** Cria novo app no catálogo (apenas super_admin). */
export async function POST(request: Request) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const forbidden = await superAdminOr403(auth.session!, request, apiT);
  if (forbidden) return forbidden;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = createAppBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }

  const result = await runCreateApp(parsed.data);
  if (!result.ok) {
    return jsonError("CONFLICT", "Slug já está em uso.", 409);
  }

  return jsonSuccess({ app: mapAppToDto(result.app) }, { status: 201 });
}
