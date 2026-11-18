import { withTenantRoute } from "@/lib/api/route-handler";
import { whatsappDispatcher } from "@/infrastructure/whatsapp/whatsapp-dispatcher";
import { jsonError, jsonSuccess } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export const POST = withTenantRoute(async ({ tenantId, apiT }) => {
  const result = await whatsappDispatcher.testConnection(tenantId);

  if (!result.ok) {
    return jsonError("WHATSAPP_CONNECTION_FAILED", result.error ?? apiT("errors.whatsappConnectionTestFailed"), 422);
  }

  return jsonSuccess({ ok: true });
}, { role: "admin" });
