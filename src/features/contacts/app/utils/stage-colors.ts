import type { ConversationStatus } from "@/types/api/contacts-v1";

/** Pílula de etapa do lead nos tons do kit (novo, em atendimento, qualificado, descartado). */
export const STAGE_PILL_CLASS: Record<ConversationStatus, string> = {
  new: "bg-info-soft text-info",
  in_progress: "bg-warning-soft text-warning",
  waiting_contact: "bg-warning-soft text-warning",
  qualified: "bg-success-soft text-success",
  discarded: "bg-muted text-muted-foreground",
};

export const STAGE_ORDER: ConversationStatus[] = ["new", "in_progress", "qualified", "discarded"];
