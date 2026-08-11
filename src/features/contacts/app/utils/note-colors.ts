import type { LeadNoteColor } from "@/types/api/contacts-v1";
import type { AgendaEventType } from "@/types/api/agenda-v1";

export type ColorToken = {
  solid: string;
  ink: string;
  soft: string;
  line: string;
};

/** Paleta de nota (4 opções) e tipo de compromisso (4 tipos) — mesma tabela, ver handoff de design. */
export const NOTE_COLOR_TOKENS: Record<LeadNoteColor, ColorToken> = {
  amber: { solid: "#f59e0b", ink: "#92400e", soft: "rgba(245,158,11,.14)", line: "rgba(245,158,11,.5)" },
  sky: { solid: "#0ea5e9", ink: "#075985", soft: "rgba(14,165,233,.14)", line: "rgba(14,165,233,.5)" },
  emerald: { solid: "#10b981", ink: "#065f46", soft: "rgba(16,185,129,.14)", line: "rgba(16,185,129,.5)" },
  violet: { solid: "#8b5cf6", ink: "#5b21b6", soft: "rgba(139,92,246,.14)", line: "rgba(139,92,246,.5)" },
};

/** Tipo de compromisso → mesma cor da nota equivalente (Ligação=amber, Consulta=sky, Exame=emerald, Retorno=violet). */
export const EVENT_TYPE_COLOR: Record<AgendaEventType, LeadNoteColor> = {
  ligacao: "amber",
  consulta: "sky",
  exame: "emerald",
  retorno: "violet",
};
