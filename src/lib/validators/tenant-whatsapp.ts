import { z } from "zod";

export const patchWhatsAppSettingsBodySchema = z
  .object({
    whatsappEnabled: z.boolean().optional(),
    whatsappPhoneNumberId: z.string().max(64).nullable().optional(),
    whatsappBusinessAccountId: z.string().max(64).nullable().optional(),
    whatsappAccessToken: z.string().max(512).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Informe ao menos um campo para atualizar.",
  });
