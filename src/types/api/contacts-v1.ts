/**
 * DTOs de API v1 do kanban de contatos multicanal (WhatsApp/Instagram).
 * Ver docs/superpowers/specs/2026-08-03-kanban-contatos-multicanal-design.md
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
  clientId: string | null;
  clientName: string | null;
  assignedToUserId: string | null;
  assignedToUserName: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
};

export type ConversationsBoardResponseData = {
  columns: Record<ConversationStatus, ConversationCardDto[]>;
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
