import { z } from "zod";

import {
  MAX_UPLOAD_SIZE_BYTES,
  isAllowedUploadMimeType,
} from "@/lib/constants/file-upload";

/** MIME aceito no upload — allowlist alinhada à validação de magic bytes. */
export const uploadMimeTypeSchema = z
  .string()
  .min(1)
  .max(200)
  .refine(isAllowedUploadMimeType, { message: "Tipo de arquivo não permitido." });

export const uploadSizeBytesSchema = z
  .number()
  .int()
  .positive()
  .max(MAX_UPLOAD_SIZE_BYTES);

export const postFilePresignBodySchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: uploadMimeTypeSchema,
  clientId: z.string().cuid().optional(),
  /** Foto de perfil: grava em `tenants/{id}/avatars/` e permite referência `gcs:key` sem URL pública. */
  purpose: z.enum(["avatar"]).optional(),
});

export const postFileRegisterBodySchema = z.object({
  key: z.string().min(1).max(500),
  fileName: z.string().min(1).max(255),
  mimeType: uploadMimeTypeSchema,
  sizeBytes: uploadSizeBytesSchema,
  clientId: z.string().cuid().optional(),
});

export const postFileDownloadPresignBodySchema = z.object({
  fileId: z.string().cuid(),
});
