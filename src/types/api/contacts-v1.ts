/**
 * DTOs de API v1 da tela de Conversas multicanal (WhatsApp/Instagram).
 * Ver docs/superpowers/plans/2026-08-11-conversas-agenda-whatsapp.md
 */

export type ConversationChannel = "whatsapp" | "instagram";

export type ConversationStatus =
  | "new"
  | "in_progress"
  | "waiting_contact"
  | "qualified"
  | "discarded";

export type MessageDirection = "inbound" | "outbound";

export type MessageType = "text" | "image" | "document" | "audio" | "video";

export type MessageStatus = "sent" | "delivered" | "read" | "failed";

export type ConversationCardDto = {
  id: string;
  channel: ConversationChannel;
  externalId: string;
  displayName: string;
  status: ConversationStatus;
  /** Quando a etapa atual foi assumida — alimenta o "(N dias)" no painel do lead. */
  stageChangedAt: string;
  clientId: string | null;
  clientName: string | null;
  assignedToUserId: string | null;
  assignedToUserName: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
};

export type MessageDto = {
  id: string;
  direction: MessageDirection;
  type: MessageType;
  body: string | null;
  status: MessageStatus;
  createdAt: string;
};

export type ConversationDetailResponseData = {
  conversation: ConversationCardDto;
  messages: MessageDto[];
};

export type SendMessageRequestBody = {
  body: string;
  attachment?: string | null;
};

export type ConversationListQueryParams = {
  channel?: ConversationChannel;
  status?: ConversationStatus;
  q?: string;
  cursor?: string;
  limit?: number;
};

/** Alias — todo card de conversa já traz `stageChangedAt` desde a base `ConversationCardDto`. */
export type ConversationListItemDto = ConversationCardDto;

export type ConversationsListResponseData = {
  data: ConversationListItemDto[];
  nextCursor: string | null;
  totalItems: number;
};

export type QuickPhraseDto = {
  id: string;
  slug: string;
  title: string;
  body: string;
  attachment: string | null;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
};

export type QuickPhrasesResponseData = {
  data: QuickPhraseDto[];
};

export type UpsertQuickPhraseRequestBody = {
  slug: string;
  title: string;
  body: string;
  attachment?: string | null;
};

export type LeadNoteColor = "amber" | "sky" | "emerald" | "violet";

export type LeadNoteDto = {
  id: string;
  conversationId: string;
  authorId: string;
  authorName: string | null;
  text: string;
  color: LeadNoteColor;
  pinned: boolean;
  editedAt: string | null;
  createdAt: string;
};

export type LeadNotesResponseData = {
  data: LeadNoteDto[];
};

export type UpsertLeadNoteRequestBody = {
  text: string;
  color: LeadNoteColor;
  pinned: boolean;
};

/** Corpo de POST /conversations/{id}/convert-to-client — subconjunto de CreateClientRequestBody. */
export type ConvertLeadToClientRequestBody = {
  name: string;
  phone?: string;
  email: string;
  documentId?: string | null;
  caseDescription?: string | null;
};
