import { z } from "zod";

/** As 4 colunas exibidas no kanban de contatos — ver contacts-kanban-board.tsx. `waiting_contact` existe no enum do schema mas não é usado aqui. */
const boardConversationStatusEnum = z.enum(["new", "in_progress", "qualified", "discarded"]);

export const patchConversationStatusBodySchema = z.object({
  status: boardConversationStatusEnum,
});
