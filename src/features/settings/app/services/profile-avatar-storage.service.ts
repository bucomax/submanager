import { normalizeApiError } from "@/lib/api/axios-error";
import { apiClient } from "@/lib/api/http-client";
import { readFileHeader, validateMagicBytes } from "@/lib/utils/magic-bytes";
import { formatUserProfileImageGcsRef } from "@/lib/utils/user-profile-image-ref";
import type { ApiEnvelope } from "@/shared/types/api/v1";

const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

type PresignResponseData = {
  key: string;
  uploadUrl: string;
  mimeType: string;
  /** Headers extras exigidos no PUT (vazio quando o range de tamanho não é exigido). */
  uploadHeaders?: Record<string, string>;
};

/**
 * - `available`: API confirmou GCS configurado (upload + referência `gcs:key`).
 * - `unavailable`: API respondeu com `available: false`.
 * - `unknown`: rede/parse/erro — não bloquear upload; o presign dirá se de fato funciona.
 */
export type ProfileAvatarStorageState = "available" | "unavailable" | "unknown";

export async function fetchProfileAvatarStorageState(): Promise<ProfileAvatarStorageState> {
  try {
    const res = await apiClient.get<ApiEnvelope<{ available: boolean }>>(
      "/api/v1/files/storage-status",
    );
    const body = res.data;
    if (body?.success !== true || body.data == null || typeof body.data.available !== "boolean") {
      return "unknown";
    }
    return body.data.available ? "available" : "unavailable";
  } catch {
    return "unknown";
  }
}

export type ProfileAvatarValidationErrorCode = "INVALID_TYPE" | "TOO_LARGE";

export class ProfileAvatarValidationError extends Error {
  constructor(
    public readonly code: ProfileAvatarValidationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProfileAvatarValidationError";
  }
}

export async function uploadProfileAvatarToStorage(file: File): Promise<string> {
  const mimeType = file.type?.trim() || "";
  if (!ALLOWED_IMAGE_MIME.has(mimeType)) {
    throw new ProfileAvatarValidationError("INVALID_TYPE", "INVALID_TYPE");
  }
  if (file.size > MAX_PROFILE_IMAGE_BYTES) {
    throw new ProfileAvatarValidationError("TOO_LARGE", "TOO_LARGE");
  }

  const header = await readFileHeader(file);
  const mbResult = validateMagicBytes(header, mimeType);
  if (!mbResult.valid) {
    throw new ProfileAvatarValidationError("INVALID_TYPE", "INVALID_TYPE");
  }

  try {
    const presignRes = await apiClient.post<ApiEnvelope<PresignResponseData>>("/api/v1/files/presign", {
      fileName: file.name || "avatar.jpg",
      mimeType,
      purpose: "avatar",
    });
    if (!presignRes.data.success) {
      throw new Error(presignRes.data.error.message);
    }
    const { key, uploadUrl, uploadHeaders } = presignRes.data.data;

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": mimeType, ...(uploadHeaders ?? {}) },
    });
    if (!putRes.ok) {
      throw new Error(`Upload failed (${putRes.status})`);
    }

    return formatUserProfileImageGcsRef(key);
  } catch (e) {
    throw normalizeApiError(e);
  }
}
