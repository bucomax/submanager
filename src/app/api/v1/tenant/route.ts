import { withTenantRoute } from "@/lib/api/route-handler";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { patchTenantClinicBodySchema } from "@/lib/validators/tenant-clinic";
import {
  getTenantClinicProfile,
  updateTenantClinicProfile,
  type TenantClinicDto,
} from "@/application/use-cases/tenant/tenant-clinic-profile";

export const dynamic = "force-dynamic";

function toTenantClinicDto(tenant: TenantClinicDto) {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    taxId: tenant.taxId,
    phone: tenant.phone,
    addressLine: tenant.addressLine,
    city: tenant.city,
    postalCode: tenant.postalCode,
    affiliatedHospitals: tenant.affiliatedHospitals,
  };
}

export const GET = withTenantRoute(async ({ tenantId, apiT }) => {
  const tenant = await getTenantClinicProfile(tenantId);

  if (!tenant) {
    return jsonError("NOT_FOUND", apiT("errors.tenantNotFound"), 404);
  }

  return jsonSuccess({
    tenant: toTenantClinicDto(tenant),
  });
});

export const PATCH = withTenantRoute(async ({ request, tenantId, apiT }) => {
  const parsed = await parseJsonBody(request, patchTenantClinicBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const data = parsed.data;
  const tenant = await updateTenantClinicProfile(tenantId, {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.taxId !== undefined ? { taxId: data.taxId } : {}),
    ...(data.phone !== undefined ? { phone: data.phone } : {}),
    ...(data.addressLine !== undefined ? { addressLine: data.addressLine } : {}),
    ...(data.city !== undefined ? { city: data.city } : {}),
    ...(data.postalCode !== undefined ? { postalCode: data.postalCode } : {}),
    ...(data.affiliatedHospitals !== undefined ? { affiliatedHospitals: data.affiliatedHospitals } : {}),
  });

  return jsonSuccess({
    tenant: toTenantClinicDto(tenant!),
  });
}, { role: "admin" });
