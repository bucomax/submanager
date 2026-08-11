/**
 * DTOs de API v1 da tela Agenda (compromissos por lead).
 * Ver docs/superpowers/plans/2026-08-11-conversas-agenda-whatsapp.md
 */

export type AgendaEventType = "consulta" | "retorno" | "exame" | "ligacao";

export type AgendaEventDto = {
  id: string;
  conversationId: string | null;
  clientId: string | null;
  title: string;
  type: AgendaEventType;
  startsAt: string;
  durationMin: number;
  ownerUserId: string;
  ownerUserName: string | null;
  leadName: string | null;
  notes: string | null;
  createdAt: string;
};

export type AgendaListQueryParams = {
  from: string;
  to: string;
};

export type AgendaListResponseData = {
  data: AgendaEventDto[];
};

export type CreateAgendaEventRequestBody = {
  conversationId?: string | null;
  clientId?: string | null;
  title: string;
  type: AgendaEventType;
  startsAt: string;
  durationMin: number;
  ownerUserId: string;
  notes?: string | null;
  sendConfirmation: boolean;
};

export type UpdateAgendaEventRequestBody = Partial<
  Omit<CreateAgendaEventRequestBody, "sendConfirmation">
>;
