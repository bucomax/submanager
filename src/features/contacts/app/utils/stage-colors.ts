import type { ConversationStatus } from "@/types/api/contacts-v1";

/** Pílula de etapa — claro por etapa, escuro uniforme (ver handoff de design). */
export const STAGE_PILL_CLASS: Record<ConversationStatus, string> = {
  new: "bg-[#ecfdf5] text-[#047857] dark:bg-white/10 dark:text-[#e9edef]",
  in_progress: "bg-[#eff6ff] text-[#1d4ed8] dark:bg-white/10 dark:text-[#e9edef]",
  waiting_contact: "bg-[#eff6ff] text-[#1d4ed8] dark:bg-white/10 dark:text-[#e9edef]",
  qualified: "bg-[#f5f3ff] text-[#6d28d9] dark:bg-white/10 dark:text-[#e9edef]",
  discarded: "bg-[#f4f4f5] text-[#52525b] dark:bg-white/10 dark:text-[#e9edef]",
};

export const STAGE_ORDER: ConversationStatus[] = ["new", "in_progress", "qualified", "discarded"];
