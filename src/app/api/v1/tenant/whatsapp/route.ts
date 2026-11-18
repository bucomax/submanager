import { withTenantRoute } from "@/lib/api/route-handler";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { patchWhatsAppSettingsBodySchema } from "@/lib/validators/tenant-whatsapp";
import {
  getTenantWhatsAppSettings,
  patchTenantWhatsAppSettings,
  tenantWhatsAppToDto,
} from "@/application/use-cases/tenant/tenant-whatsapp-settings";

export const dynamic = "force-dynamic";

export const GET = withTenantRoute(async ({ tenantId, apiT }) => {
  const tenant = await getTenantWhatsAppSettings(tenantId);

  if (!tenant) {
    return jsonError("NOT_FOUND", apiT("errors.tenantNotFound"), 404);
  }

  return jsonSuccess({ whatsapp: tenantWhatsAppToDto(tenant) });
}, { role: "admin" });

export const PATCH = withTenantRoute(async ({ request, tenantId, apiT }) => {
  const parsed = await parseJsonBody(request, patchWhatsAppSettingsBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const tenant = await patchTenantWhatsAppSettings({
    tenantId,
    data: parsed.data,
  });

  return jsonSuccess({ whatsapp: tenantWhatsAppToDto(tenant) });
}, { role: "admin" });
