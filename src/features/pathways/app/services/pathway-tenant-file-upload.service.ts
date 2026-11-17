import { normalizeApiError } from "@/lib/api/axios-error";
import { apiClient } from "@/lib/api/http-client";
import { readFileHeader, validateMagicBytes } from "@/lib/utils/magic-bytes";
import { putFileWithUploadProgress } from "@/lib/utils/upload-put-xhr";
import type { ApiEnvelope } from "@/shared/types/api/v1";

type PresignResponseData = {
  key: string;
  uploadUrl: string;
  mimeType: string;
  /** Headers exigidos pelo PUT assinado (ex.: `x-goog-content-length-range`); vazio por padrão. */
  uploadHeaders?: Record<string, string>;
};

type RegisterFileDto = {
  id: string;
  fileName: string;
  mimeType: string;
};

export type UploadTenantLibraryProgress = (percent: number) => void;

/**
 * Upload para a biblioteca do tenant (sem `clientId`), para anexar a etapas da jornada.
 * `onUploadProgress` recebe 0–100 (upload + registro no painel).
 */
export async function uploadTenantLibraryFile(
  file: File,
  onUploadProgress?: UploadTenantLibraryProgress,
): Promise<RegisterFileDto> {
  const mimeType = file.type?.trim() || "application/octet-stream";
  const bump = (pct: number) => onUploadProgress?.(Math.min(100, Math.max(0, Math.round(pct))));

  try {
    const header = await readFileHeader(file);
    const mbResult = validateMagicBytes(header, mimeType);
    if (!mbResult.valid) {
      throw new Error("O conteúdo do arquivo não corresponde ao tipo declarado.");
    }
    const presignRes = await apiClient.post<ApiEnvelope<PresignResponseData>>("/api/v1/files/presign", {
      fileName: file.name,
      mimeType,
    }, { skipErrorToast: true });
    if (!presignRes.data.success) {
      throw new Error(presignRes.data.error.message);
    }
    const { key, uploadUrl, uploadHeaders } = presignRes.data.data;

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

    const regRes = await apiClient.post<ApiEnvelope<{ file: RegisterFileDto }>>("/api/v1/files", {
      key,
      fileName: file.name,
      mimeType,
      sizeBytes: file.size,
    }, { skipErrorToast: true });
    bump(96);
    if (!regRes.data.success) {
      throw new Error(regRes.data.error.message);
    }
    bump(100);
    return regRes.data.data.file;
  } catch (e) {
    throw normalizeApiError(e);
  }
}
