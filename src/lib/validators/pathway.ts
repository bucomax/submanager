import { z } from "zod";

import { zodApiMsg } from "@/lib/api/zod-i18n";

export const postPathwayBodySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(10_000).optional(),
});

export const patchPathwayBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(10_000).nullable().optional(),
});

export const postPathwayVersionBodySchema = z.object({
  graphJson: z.any(),
});

export const patchPathwayVersionBodySchema = z.object({
  graphJson: z.any(),
});

/** Corpo vazio `{}` válido: usa o `graphJson` da versão no servidor. */
export const postPathwayPublishPreviewBodySchema = z.object({
  graphJson: z.any().optional(),
});

export const postPatientPathwayBodySchema = z.object({
  clientId: z.string().cuid(),
  pathwayId: z.string().cuid(),
});

export const postStageTransitionBodySchema = z
  .object({
    toStageId: z.string().cuid(),
    note: z.string().max(2000).optional(),
    force: z.boolean().optional(),
    overrideReason: z.string().max(2000).optional(),
    /** Chave de idempotência opcional (ex.: UUID gerado pelo cliente); replay devolve a transição já feita. */
    correlationId: z.string().min(8).max(128).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.force) return;
    const trimmed = data.overrideReason?.trim() ?? "";
    if (trimmed.length < 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: zodApiMsg("errors.validationOverrideReasonMin"),
        path: ["overrideReason"],
      });
    }
  });
