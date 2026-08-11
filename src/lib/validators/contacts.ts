import { z } from "zod";

/** As 4 etapas exibidas na tela de Conversas — ver conversations-page.tsx. `waiting_contact` existe no enum do schema mas não é usado aqui. */
const boardConversationStatusEnum = z.enum(["new", "in_progress", "qualified", "discarded"]);

export const patchConversationStatusBodySchema = z.object({
  status: boardConversationStatusEnum,
});

export const sendMessageBodySchema = z.object({
  body: z.string().trim().min(1).max(4096),
  attachment: z.string().trim().max(255).nullable().optional(),
});

export const upsertQuickPhraseBodySchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "slug deve conter apenas letras minúsculas, números e hífen"),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(4096),
  attachment: z.string().trim().max(255).nullable().optional(),
});

const leadNoteColorEnum = z.enum(["amber", "sky", "emerald", "violet"]);

export const upsertLeadNoteBodySchema = z.object({
  text: z.string().trim().min(1).max(2000),
  color: leadNoteColorEnum,
  pinned: z.boolean(),
});
