export type WhatsAppDispatchDocument = {
  fileName: string;
  r2Key: string;
  mimeType: string;
};

export type WhatsAppDispatchInput = {
  tenantId: string;
  stageTransitionId: string;
  clientId: string;
  recipientPhone: string;
  stageName: string;
  documents: WhatsAppDispatchDocument[];
};

export type WhatsAppDispatchResult = {
  /**
   * ChannelDispatch IDs created in this run: one per document attempted (documents already sent in an
   * earlier attempt are skipped) + one for the confirmation message, only when it was sent now.
   */
  dispatchIds: string[];
};

export type WhatsAppStatusUpdate = {
  /** Tenant dono do número (resolvido pelo `phone_number_id` do webhook); isola a busca do dispatch. */
  tenantId: string;
  externalMessageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  errorCode?: string;
  errorTitle?: string;
};

export type WhatsAppButtonReply = {
  tenantId: string;
  externalMessageId: string;
  buttonPayload: string;
  timestamp: string;
};

export interface IWhatsAppDispatcher {
  dispatch(input: WhatsAppDispatchInput): Promise<WhatsAppDispatchResult>;
  handleStatusUpdate(update: WhatsAppStatusUpdate): Promise<void>;
  handleButtonReply(reply: WhatsAppButtonReply): Promise<void>;
  testConnection(tenantId: string): Promise<{ ok: boolean; error?: string }>;
}
