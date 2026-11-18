import { withTenantRoute } from "@/lib/api/route-handler";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { patchTenantNotificationsBodySchema } from "@/lib/validators/tenant-notifications";
import {
  getTenantNotificationSettings,
  patchTenantNotificationSettings,
  toTenantNotificationsDto,
} from "@/application/use-cases/tenant/tenant-notification-settings";

export const dynamic = "force-dynamic";

export const GET = withTenantRoute(async ({ tenantId, apiT }) => {
  const tenant = await getTenantNotificationSettings(tenantId);

  if (!tenant) {
    return jsonError("NOT_FOUND", apiT("errors.tenantNotFound"), 404);
  }

  return jsonSuccess({
    notifications: toTenantNotificationsDto(tenant),
  });
});

export const PATCH = withTenantRoute(async ({ request, tenantId, apiT }) => {
  const parsed = await parseJsonBody(request, patchTenantNotificationsBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const tenant = await patchTenantNotificationSettings({
    tenantId,
    data: parsed.data,
  });

  return jsonSuccess({
    notifications: toTenantNotificationsDto(tenant),
  });
}, { role: "admin" });
