import type { UseCaseErrorTable } from "@/lib/api/map-use-case-error";

/** Use cases de conversa devolvem `reason` (não `code`); a tabela é indexada por ele. */
export const CONVERT_CONVERSATION_ERRORS: UseCaseErrorTable<"conversation_not_found" | "already_linked"> = {
  conversation_not_found: { status: 404, errorCode: "NOT_FOUND", messageKey: "errors.conversationNotFound" },
  already_linked: { status: 409, errorCode: "CONFLICT", messageKey: "errors.conversationAlreadyLinked" },
};
