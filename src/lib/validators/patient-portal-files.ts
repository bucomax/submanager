import { z } from "zod";

import { uploadMimeTypeSchema, uploadSizeBytesSchema } from "@/lib/validators/file";

export const patientPortalFilePresignBodySchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: uploadMimeTypeSchema,
});

export const patientPortalFileRegisterBodySchema = z.object({
  key: z.string().min(1).max(500),
  fileName: z.string().min(1).max(255),
  mimeType: uploadMimeTypeSchema,
  sizeBytes: uploadSizeBytesSchema,
});

export const patientPortalFileDownloadPresignBodySchema = z.object({
  fileId: z.string().cuid(),
});

export const patchClientFileReviewBodySchema = z.object({
  decision: z.enum(["approve", "reject"]),
  rejectReason: z.string().max(500).optional(),
});
