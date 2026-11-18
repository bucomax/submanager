import { withTenantRoute } from "@/lib/api/route-handler";
import { mapUseCaseError } from "@/lib/api/map-use-case-error";
import { EMAIL_DOMAIN_VERIFY_ERRORS } from "@/lib/api/error-tables/tenant-settings";
import { jsonSuccess } from "@/lib/api-response";
import { verifyTenantEmailDomain } from "@/application/use-cases/tenant/tenant-email-domain";

export const dynamic = "force-dynamic";

export const POST = withTenantRoute(async ({ tenantId, apiT }) => {
  const result = await verifyTenantEmailDomain({ tenantId });
  if (!result.ok) {
    return mapUseCaseError(result.code, EMAIL_DOMAIN_VERIFY_ERRORS, apiT, { message: result.errorMessage });
  }
  return jsonSuccess({ emailDomain: result.dto });
}, { role: "admin" });
