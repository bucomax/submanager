import { z } from "zod";

export const createFeedbackBodySchema = z.object({
  type: z.enum(["bug", "suggestion", "question", "other"]),
  message: z.string().trim().min(10).max(2000),
  sentryEventId: z.string().trim().max(64).nullable().optional(),
  requestId: z.string().trim().max(128).nullable().optional(),
  // Só o pathname: a rota rejeita qualquer coisa com query string (LGPD — query
  // string pode carregar busca por nome de paciente).
  pagePath: z.string().trim().min(1).max(512).regex(/^\/[^?#]*$/),
  locale: z.string().trim().min(2).max(10),
});

export const listFeedbackQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(["open", "triaged", "in_progress", "resolved", "wont_fix", "duplicate"])
    .optional(),
  type: z.enum(["bug", "suggestion", "question", "other"]).optional(),
  tenantId: z.string().trim().optional(),
});

export const patchFeedbackBodySchema = z
  .object({
    status: z
      .enum(["open", "triaged", "in_progress", "resolved", "wont_fix", "duplicate"])
      .optional(),
    adminNote: z.string().trim().max(5000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Informe ao menos um campo para atualizar.",
  });
