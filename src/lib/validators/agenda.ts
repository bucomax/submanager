import { z } from "zod";

const agendaEventTypeEnum = z.enum(["consulta", "retorno", "exame", "ligacao"]);

export const createAgendaEventBodySchema = z.object({
  conversationId: z.string().trim().min(1).nullable().optional(),
  clientId: z.string().trim().min(1).nullable().optional(),
  title: z.string().trim().min(1).max(160),
  type: agendaEventTypeEnum,
  startsAt: z.string().trim().min(1),
  durationMin: z.number().int().min(5).max(480),
  ownerUserId: z.string().trim().min(1),
  notes: z.string().trim().max(2000).nullable().optional(),
  sendConfirmation: z.boolean(),
});

export const updateAgendaEventBodySchema = createAgendaEventBodySchema
  .omit({ sendConfirmation: true })
  .partial();
