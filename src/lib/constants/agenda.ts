import type { AgendaEventType } from "@/types/api/agenda-v1";

/** Rótulo pt-BR fixo do tipo de compromisso — usado na mensagem de confirmação enviada ao lead. */
export const EVENT_TYPE_LABEL_PT_BR: Record<AgendaEventType, string> = {
  consulta: "Consulta",
  retorno: "Retorno",
  exame: "Exame",
  ligacao: "Ligação",
};
