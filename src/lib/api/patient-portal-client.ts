import { PATIENT_PORTAL_TENANT_SLUG_HEADER } from "@/lib/constants/patient-portal";
import { readFileHeader, validateMagicBytes } from "@/lib/utils/magic-bytes";
import { putFileWithUploadProgress } from "@/lib/utils/upload-put-xhr";
import type { PatchPatientPortalProfileBody } from "@/lib/validators/patient-portal-profile";
import type {
  PatientPortalDetailResponseData,
  PatientPortalFilesListResponseData,
  PatientPortalFileRegisteredResponse,
  PatientPortalOverviewResponse,
  PatientPortalProfilePatchResponseData,
  PatientPortalTimelineResponseData,
} from "@/types/api/patient-portal-v1";

/** Cookie do portal ausente ou expirado — UI deve orientar o paciente a usar o link mágico. */
export class PatientPortalUnauthorizedError extends Error {
  constructor() {
    super("UNAUTHORIZED");
    this.name = "PatientPortalUnauthorizedError";
  }
}

type SuccessEnvelope<T> = { success: true; data: T };
type ErrorEnvelope = { success: false; error: { message: string; code?: string } };

async function parseJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function withPortalTenant(tenantSlug: string, init: RequestInit = {}): RequestInit {
  const h = new Headers(init.headers);
  h.set(PATIENT_PORTAL_TENANT_SLUG_HEADER, tenantSlug);
  return { ...init, headers: h, credentials: init.credentials ?? "include" };
}

/** Troca token do link mágico por cookie de sessão do portal (mesma origem). */
export async function exchangePatientPortalToken(tenantSlug: string, token: string): Promise<void> {
  const res = await fetch(
    `/api/v1/public/patient-portal/${encodeURIComponent(tenantSlug)}/exchange`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token }),
    },
  );
  const body = (await parseJson(res)) as SuccessEnvelope<{ ok: boolean }> | ErrorEnvelope | null;
  if (!res.ok || !body || body.success !== true) {
    const msg =
      body && "error" in body && body.error?.message
        ? body.error.message
        : "Falha ao validar o link.";
    throw new Error(msg);
  }
}

/** Solicita código OTP (e-mail / webhook WhatsApp se configurado). */
export async function requestPatientPortalOtp(tenantSlug: string, login: string): Promise<void> {
  const res = await fetch(`/api/v1/public/patient-portal/${encodeURIComponent(tenantSlug)}/otp/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ login }),
  });
  const body = (await parseJson(res)) as SuccessEnvelope<{ ok: boolean }> | ErrorEnvelope | null;
  if (!res.ok || !body || body.success !== true) {
    const msg =
      body && "error" in body && body.error?.message
        ? body.error.message
        : "Não foi possível enviar o código.";
    throw new Error(msg);
  }
}

/** Confirma OTP e abre sessão do portal. */
export async function verifyPatientPortalOtp(
  tenantSlug: string,
  login: string,
  code: string,
): Promise<void> {
  const res = await fetch(`/api/v1/public/patient-portal/${encodeURIComponent(tenantSlug)}/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ login, code }),
  });
  const body = (await parseJson(res)) as SuccessEnvelope<{ ok: boolean }> | ErrorEnvelope | null;
  if (!res.ok || !body || body.success !== true) {
    const msg =
      body && "error" in body && body.error?.message
        ? body.error.message
        : "Código inválido ou expirado.";
    throw new Error(msg);
  }
}

/** Indica se o paciente (CPF ou e-mail) tem senha de portal cadastrada (senha vs OTP). */
export async function fetchPatientPortalLoginOptions(
  tenantSlug: string,
  login: string,
): Promise<{ hasPassword: boolean }> {
  const res = await fetch(
    `/api/v1/public/patient-portal/${encodeURIComponent(tenantSlug)}/login/options`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ login }),
    },
  );
  const body = (await parseJson(res)) as SuccessEnvelope<{ hasPassword: boolean }> | ErrorEnvelope | null;
  if (!res.ok || !body || body.success !== true) {
    const msg =
      body && "error" in body && body.error?.message
        ? body.error.message
        : "Não foi possível continuar.";
    throw new Error(msg);
  }
  return body.data;
}

/** Login com CPF ou e-mail + senha (cookie de sessão). */
export async function verifyPatientPortalPassword(
  tenantSlug: string,
  login: string,
  password: string,
): Promise<void> {
  const res = await fetch(
    `/api/v1/public/patient-portal/${encodeURIComponent(tenantSlug)}/password/verify`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ login, password }),
    },
  );
  const body = (await parseJson(res)) as SuccessEnvelope<{ ok: boolean }> | ErrorEnvelope | null;
  if (!res.ok || !body || body.success !== true) {
    const msg =
      body && "error" in body && body.error?.message
        ? body.error.message
        : "E-mail/CPF ou senha incorretos.";
    throw new Error(msg);
  }
}

export type PatientPortalPasswordUpdateBody = {
  newPassword: string;
  confirmNewPassword: string;
  currentPassword?: string;
};

/** Define ou altera a senha do portal (sessão autenticada). */
export async function updatePatientPortalPassword(
  tenantSlug: string,
  body: PatientPortalPasswordUpdateBody,
): Promise<void> {
  const res = await fetch(
    "/api/v1/patient/password",
    withPortalTenant(tenantSlug, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  const parsed = (await parseJson(res)) as SuccessEnvelope<{ ok: boolean }> | ErrorEnvelope | null;
  if (res.status === 401) {
    throw new PatientPortalUnauthorizedError();
  }
  if (!res.ok || !parsed || parsed.success !== true) {
    const msg =
      parsed && "error" in parsed && parsed.error?.message
        ? parsed.error.message
        : "Não foi possível atualizar a senha.";
    throw new Error(msg);
  }
}

export async function fetchPatientPortalOverview(tenantSlug: string): Promise<PatientPortalOverviewResponse> {
  const res = await fetch("/api/v1/patient/overview", withPortalTenant(tenantSlug));
  const body = (await parseJson(res)) as
    | SuccessEnvelope<PatientPortalOverviewResponse>
    | ErrorEnvelope
    | null;
  if (res.status === 401) {
    throw new PatientPortalUnauthorizedError();
  }
  if (!res.ok || !body || body.success !== true) {
    const msg =
      body && "error" in body && body.error?.message
        ? body.error.message
        : "Falha ao carregar o portal.";
    throw new Error(msg);
  }
  return body.data;
}

export async function fetchPatientPortalDetail(
  tenantSlug: string,
  page = 1,
  limit = 20,
): Promise<PatientPortalDetailResponseData> {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  const res = await fetch(`/api/v1/patient/detail?${qs}`, withPortalTenant(tenantSlug));
  const body = (await parseJson(res)) as SuccessEnvelope<PatientPortalDetailResponseData> | ErrorEnvelope | null;
  if (res.status === 401) {
    throw new PatientPortalUnauthorizedError();
  }
  if (!res.ok || !body || body.success !== true) {
    const msg =
      body && "error" in body && body.error?.message
        ? body.error.message
        : "Falha ao carregar a ficha.";
    throw new Error(msg);
  }
  return body.data;
}

export async function patchPatientPortalProfile(
  tenantSlug: string,
  body: PatchPatientPortalProfileBody,
): Promise<PatientPortalProfilePatchResponseData> {
  const res = await fetch(
    "/api/v1/patient/profile",
    withPortalTenant(tenantSlug, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  const parsed = (await parseJson(res)) as SuccessEnvelope<PatientPortalProfilePatchResponseData> | ErrorEnvelope | null;
  if (res.status === 401) {
    throw new PatientPortalUnauthorizedError();
  }
  if (!res.ok || !parsed || parsed.success !== true) {
    const msg =
      parsed && "error" in parsed && parsed.error?.message
        ? parsed.error.message
        : "Não foi possível salvar.";
    throw new Error(msg);
  }
  return parsed.data;
}

export async function logoutPatientPortal(): Promise<void> {
  await fetch("/api/v1/patient/logout", { method: "POST", credentials: "include" });
}

export async function fetchPatientPortalTimeline(
  tenantSlug: string,
  page = 1,
  limit = 20,
): Promise<PatientPortalTimelineResponseData> {
  const qs = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const res = await fetch(`/api/v1/patient/timeline?${qs}`, withPortalTenant(tenantSlug));
  const body = (await parseJson(res)) as
    | SuccessEnvelope<PatientPortalTimelineResponseData>
    | ErrorEnvelope
    | null;
  if (res.status === 401) {
    throw new PatientPortalUnauthorizedError();
  }
  if (!res.ok || !body || body.success !== true) {
    const msg =
      body && "error" in body && body.error?.message
        ? body.error.message
        : "Falha ao carregar a linha do tempo.";
    throw new Error(msg);
  }
  return body.data;
}

export async function fetchPatientPortalFiles(
  tenantSlug: string,
  page = 1,
  limit = 20,
): Promise<PatientPortalFilesListResponseData> {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  const res = await fetch(`/api/v1/patient/files?${qs}`, withPortalTenant(tenantSlug));
  const body = (await parseJson(res)) as
    | SuccessEnvelope<PatientPortalFilesListResponseData>
    | ErrorEnvelope
    | null;
  if (res.status === 401) {
    throw new PatientPortalUnauthorizedError();
  }
  if (!res.ok || !body || body.success !== true) {
    const msg =
      body && "error" in body && body.error?.message
        ? body.error.message
        : "Falha ao carregar arquivos.";
    throw new Error(msg);
  }
  return body.data;
}

type PresignPutResponse = {
  key: string;
  uploadUrl: string;
  mimeType: string;
  /** Headers que o PUT assinado exige (ex.: `x-goog-content-length-range`); vazio por padrão. */
  uploadHeaders?: Record<string, string>;
};

export type PatientPortalUploadProgress = (percent: number) => void;

/**
 * Pré-assina, envia o blob ao storage e registra metadados (fila de validação na clínica).
 * `onUploadProgress` opcional: 0–100 (upload + registro).
 */
export async function uploadPatientPortalFile(
  tenantSlug: string,
  file: File,
  onUploadProgress?: PatientPortalUploadProgress,
): Promise<PatientPortalFileRegisteredResponse> {
  const mimeType = file.type?.trim() || "application/octet-stream";
  const bump = (pct: number) => onUploadProgress?.(Math.min(100, Math.max(0, Math.round(pct))));

  const header = await readFileHeader(file);
  const mbResult = validateMagicBytes(header, mimeType);
  if (!mbResult.valid) {
    throw new Error("O conteúdo do arquivo não corresponde ao tipo declarado.");
  }

  const presignRes = await fetch(
    "/api/v1/patient/files/presign",
    withPortalTenant(tenantSlug, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, mimeType }),
    }),
  );
  const presignBody = (await parseJson(presignRes)) as SuccessEnvelope<PresignPutResponse> | ErrorEnvelope | null;
  if (presignRes.status === 401) {
    throw new PatientPortalUnauthorizedError();
  }
  if (!presignRes.ok || !presignBody || presignBody.success !== true) {
    const msg =
      presignBody && "error" in presignBody && presignBody.error?.message
        ? presignBody.error.message
        : "Falha ao preparar envio.";
    throw new Error(msg);
  }
  const { key, uploadUrl, uploadHeaders } = presignBody.data;

  bump(2);
  await putFileWithUploadProgress(
    uploadUrl,
    file,
    mimeType,
    (raw) => {
      bump(2 + raw * 0.78);
    },
    uploadHeaders,
  );
  bump(82);

  const regRes = await fetch(
    "/api/v1/patient/files",
    withPortalTenant(tenantSlug, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key,
        fileName: file.name,
        mimeType,
        sizeBytes: file.size,
      }),
    }),
  );
  bump(96);
  const regBody = (await parseJson(regRes)) as
    | SuccessEnvelope<PatientPortalFileRegisteredResponse>
    | ErrorEnvelope
    | null;
  if (regRes.status === 401) {
    throw new PatientPortalUnauthorizedError();
  }
  if (!regRes.ok || !regBody || regBody.success !== true) {
    const msg =
      regBody && "error" in regBody && regBody.error?.message
        ? regBody.error.message
        : "Falha ao registrar arquivo.";
    throw new Error(msg);
  }
  bump(100);
  return regBody.data;
}

export async function requestPatientPortalFileDownloadPresign(
  tenantSlug: string,
  fileId: string,
): Promise<string> {
  const res = await fetch(
    "/api/v1/patient/files/presign-download",
    withPortalTenant(tenantSlug, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId }),
    }),
  );
  const body = (await parseJson(res)) as
    | SuccessEnvelope<{ downloadUrl: string }>
    | ErrorEnvelope
    | null;
  if (res.status === 401) {
    throw new PatientPortalUnauthorizedError();
  }
  if (!res.ok || !body || body.success !== true) {
    const msg =
      body && "error" in body && body.error?.message
        ? body.error.message
        : "Falha ao gerar link de download.";
    throw new Error(msg);
  }
  return body.data.downloadUrl;
}
