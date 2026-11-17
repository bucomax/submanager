import type { AgendaEventRefsError } from "@/application/use-cases/agenda/validate-agenda-event-references";
import type { ApiT } from "@/lib/api/i18n";
import { jsonError } from "@/lib/api-response";

/** Mapeia erro de referência da agenda para o envelope HTTP (404 sem vazar existência; 422 para responsável). */
export function agendaRefsErrorResponse(error: AgendaEventRefsError, apiT: ApiT): Response {
  switch (error) {
    case "conversation_not_found":
      return jsonError("NOT_FOUND", apiT("errors.conversationNotFound"), 404);
    case "patient_not_found":
      return jsonError("NOT_FOUND", apiT("errors.patientNotFoundInTenant"), 404);
    case "invalid_assignee":
      return jsonError("VALIDATION_ERROR", apiT("errors.invalidAssigneeForTenant"), 422);
  }
}
