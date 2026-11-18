import { defineKeys } from "@/shared/lib/query/query-keys";

const base = defineKeys("contacts");

export const contactKeys = {
  ...base,
  conversations: (filters: { q: string; channel?: string; status?: string }) =>
    base.scope("conversations", filters),
  conversationDetail: (conversationId: string) => base.scope("conversation", conversationId),
  leadNotes: (conversationId: string) => base.scope("conversation", conversationId, "notes"),
  quickPhrases: base.scope("quick-phrases"),
  leadClient: (clientId: string | null) => base.scope("lead-client", clientId),
};
