import { withSessionRoute } from "@/lib/api/route-handler";
import { mapUseCaseError } from "@/lib/api/map-use-case-error";
import { CREATE_TENANT_ERRORS } from "@/lib/api/error-tables/admin";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonSuccess } from "@/lib/api-response";
import { postAdminTenantBodySchema } from "@/lib/validators/tenant";
import { listAllTenantsForSuperAdmin } from "@/application/use-cases/admin/list-tenants";
import { runCreateTenant } from "@/application/use-cases/admin/create-tenant";

export const dynamic = "force-dynamic";

/** Lista todos os tenants com flags de gestão (apenas `super_admin`). */
export const GET = withSessionRoute(async () => {
  const rows = await listAllTenantsForSuperAdmin();

  return jsonSuccess({ tenants: rows });
}, { role: "super_admin" });

/** Cria tenant (apenas `super_admin`). */
export const POST = withSessionRoute(async ({ request, apiT }) => {
  const parsed = await parseJsonBody(request, postAdminTenantBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const result = await runCreateTenant({
    name: parsed.data.name,
    slug: parsed.data.slug,
    taxId: parsed.data.taxId ?? null,
    phone: parsed.data.phone ?? null,
    addressLine: parsed.data.addressLine ?? null,
    city: parsed.data.city ?? null,
    postalCode: parsed.data.postalCode ?? null,
    admin: parsed.data.admin ?? null,
  });

  if (!result.ok) {
    return mapUseCaseError(result.code, CREATE_TENANT_ERRORS, apiT);
  }

  return jsonSuccess(
    {
      tenant: result.tenant,
      adminCreated: result.adminCreated,
      adminEmail: result.adminEmail,
      adminUserId: result.adminUserId,
      emailDispatched: result.emailDispatched,
      emailError: result.emailError ?? null,
    },
    { status: 201 },
  );
}, { role: "super_admin" });
