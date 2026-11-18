import { withSessionRoute } from "@/lib/api/route-handler";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { createAppBodySchema } from "@/lib/validators/app";
import { listAllApps } from "@/application/use-cases/admin/apps/list-apps";
import { runCreateApp } from "@/application/use-cases/admin/apps/create-app";
import { mapAppToDto } from "@/application/use-cases/admin/apps/map-app-dto";

export const dynamic = "force-dynamic";

/** Lista todos os apps do catálogo (apenas super_admin). */
export const GET = withSessionRoute(async () => {
  const rows = await listAllApps();
  return jsonSuccess({ apps: rows.map(mapAppToDto) });
}, { role: "super_admin" });

/** Cria novo app no catálogo (apenas super_admin). */
export const POST = withSessionRoute(async ({ request, apiT }) => {
  const parsed = await parseJsonBody(request, createAppBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const result = await runCreateApp(parsed.data);
  if (!result.ok) {
    return jsonError("CONFLICT", apiT("errors.appSlugConflict"), 409);
  }

  return jsonSuccess({ app: mapAppToDto(result.app) }, { status: 201 });
}, { role: "super_admin" });
