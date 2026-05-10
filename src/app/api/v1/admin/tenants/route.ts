import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { requireSessionOr401, superAdminOr403 } from "@/lib/auth/guards";
import { postAdminTenantBodySchema } from "@/lib/validators/tenant";
import { listAllTenantsForSuperAdmin } from "@/application/use-cases/admin/list-tenants";
import { runCreateTenant } from "@/application/use-cases/admin/create-tenant";

export const dynamic = "force-dynamic";

/** Lista todos os tenants com flags de gestão (apenas `super_admin`). */
export async function GET(request: Request) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const forbidden = await superAdminOr403(auth.session!, request, apiT);
  if (forbidden) return forbidden;

  const rows = await listAllTenantsForSuperAdmin();

  return jsonSuccess({ tenants: rows });
}

/** Cria tenant (apenas `super_admin`). */
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

  const parsed = postAdminTenantBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", parsed.error.flatten().formErrors.join("; "), 422);
  }

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
    switch (result.code) {
      case "SLUG_CONFLICT":
        return jsonError("CONFLICT", apiT("errors.tenantSlugConflict"), 409);
      case "EMAIL_NOT_CONFIGURED":
        return jsonError("SERVICE_UNAVAILABLE", apiT("errors.invitesNotConfigured"), 503);
      case "EMAIL_DISABLED_ACCOUNT":
        return jsonError("CONFLICT", apiT("errors.emailDisabledAccount"), 409);
      case "USER_ALREADY_MEMBER":
        return jsonError("CONFLICT", apiT("errors.userAlreadyMember"), 409);
      case "TENANT_NOT_FOUND":
        return jsonError("INTERNAL_ERROR", apiT("errors.internalError"), 500);
      default:
        return jsonError("INTERNAL_ERROR", apiT("errors.internalError"), 500);
    }
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
}
