import { digitsOnlyCep } from "@/lib/validators/cep";
import { digitsOnlyPhone } from "@/lib/validators/phone";
import { digitsOnlyTaxDocument } from "@/lib/validators/tax-document";
import type { CreateAdminTenantRequestBody } from "@/types/api/admin-tenants-v1";
import type { CreateTenantWizardValues } from "@/features/settings/app/utils/schemas";

export type CreateTenantWizardStep = 1 | 2 | 3 | 4;

export const STEP1_FIELDS: (keyof CreateTenantWizardValues)[] = ["name", "slug", "taxId", "phone"];
export const STEP2_FIELDS: (keyof CreateTenantWizardValues)[] = [
  "postalCode",
  "addressLine",
  "addressNumber",
  "addressComp",
  "neighborhood",
  "city",
  "state",
];
export const STEP3_FIELDS: (keyof CreateTenantWizardValues)[] = ["adminEmail", "adminName"];

export const createTenantWizardDefaultValues: CreateTenantWizardValues = {
  name: "",
  slug: "",
  taxId: "",
  phone: "",
  postalCode: "",
  addressLine: "",
  addressNumber: "",
  addressComp: "",
  neighborhood: "",
  city: "",
  state: "",
  adminEmail: "",
  adminName: "",
};

function mergeTenantAddressLine(v: CreateTenantWizardValues): string | null {
  const street = v.addressLine?.trim() ?? "";
  const num = v.addressNumber?.trim() ?? "";
  const comp = v.addressComp?.trim() ?? "";
  const neighborhood = v.neighborhood?.trim() ?? "";

  let line = street;
  if (line && num) line = `${line}, ${num}`;
  else if (!line && num) line = num;
  if (comp) line = line ? `${line} - ${comp}` : comp;
  if (neighborhood) line = line ? `${line}, ${neighborhood}` : neighborhood;

  return line || null;
}

export function buildCreateTenantRequestBody(v: CreateTenantWizardValues): CreateAdminTenantRequestBody {
  const adminEmail = v.adminEmail.trim();
  const addressLineMerged = mergeTenantAddressLine(v);
  const cityPart = v.city?.trim() ?? "";
  const statePart = (v.state ?? "").trim().toUpperCase().slice(0, 2);
  const cityMerged =
    cityPart || statePart ? [cityPart, statePart].filter(Boolean).join(" · ") : null;
  const cep = digitsOnlyCep(v.postalCode ?? "");
  return {
    name: v.name.trim(),
    slug: v.slug.trim(),
    taxId: (() => {
      const d = digitsOnlyTaxDocument(v.taxId ?? "");
      return d.length > 0 ? d : null;
    })(),
    phone: (() => {
      const d = digitsOnlyPhone(v.phone ?? "");
      return d.length > 0 ? d : null;
    })(),
    addressLine: addressLineMerged ? addressLineMerged.slice(0, 500) : null,
    city: cityMerged ? cityMerged.slice(0, 200) : null,
    postalCode: cep.length === 8 ? cep : null,
    admin: adminEmail
      ? { email: adminEmail, name: v.adminName?.trim() || null }
      : null,
  };
}
