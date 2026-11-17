import { z } from "zod";

export const reportsSummaryQuerySchema = z.object({
  periodDays: z
    .enum(["7", "30", "90", "365"])
    .transform((value) => Number(value))
    .optional()
    .default(30),
  pathwayId: z.string().trim().min(1).max(191).optional(),
  opmeSupplierId: z.string().trim().min(1).max(191).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(20),
});
