import { PUBLIC_INVITE_TENANT_SLUG_HEADER } from "@/lib/constants/public-invite";
import { routing } from "@/i18n/routing";
import type {
  PublicPatientSelfRegisterRequestBody,
  PublicPatientSelfRegisterSubmitResponseData,
  PublicPatientSelfRegisterValidateResponseData,
} from "@/types/api/clients-v1";
import type { ApiEnvelope } from "@/shared/types/api/v1";
import type { RequestOptions } from "@/types/api/request-options";

function acceptLanguageForPublicRequest(): string {
  if (typeof window === "undefined") return routing.defaultLocale;
  const seg = window.location.pathname.split("/").filter(Boolean)[0];
  if (seg === "en") return "en";
  if (seg === "pt-BR") return "pt-BR";
  return routing.defaultLocale;
}

function tenantSlugHeaders(tenantSlug: string | undefined): HeadersInit {
  const h: Record<string, string> = {
    "Accept-Language": acceptLanguageForPublicRequest(),
  };
  if (tenantSlug?.trim()) {
    h[PUBLIC_INVITE_TENANT_SLUG_HEADER] = tenantSlug.trim();
  }
  return h;
}

export async function fetchPatientSelfRegisterValidation(
  token: string,
  tenantSlug?: string,
  options?: RequestOptions,
): Promise<PublicPatientSelfRegisterValidateResponseData> {
  const res = await fetch(
    `/api/v1/public/patient-self-register?token=${encodeURIComponent(token)}`,
    {
      headers: tenantSlugHeaders(tenantSlug),
      cache: "no-store",
      signal: options?.signal,
    },
  );
  const json = (await res.json()) as ApiEnvelope<PublicPatientSelfRegisterValidateResponseData>;
  if (!json.success || !json.data) {
    return { valid: false };
  }
  return json.data;
}

export async function submitPatientSelfRegister(
  body: PublicPatientSelfRegisterRequestBody,
  tenantSlug?: string,
): Promise<{ ok: true; data: PublicPatientSelfRegisterSubmitResponseData } | { ok: false; message: string }> {
  const res = await fetch("/api/v1/public/patient-self-register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...tenantSlugHeaders(tenantSlug),
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiEnvelope<PublicPatientSelfRegisterSubmitResponseData>;
  if (!json.success) {
    return { ok: false, message: json.error.message };
  }
  return { ok: true, data: json.data };
}
