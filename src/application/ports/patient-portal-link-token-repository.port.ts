export type PatientPortalLinkTokenMagicLinkRow = {
  id: string;
  clientId: string;
  expiresAt: Date;
  singleUse: boolean;
  usedAt: Date | null;
  client: {
    id: string;
    tenantId: string;
    deletedAt: Date | null;
    portalPasswordChangedAt: Date | null;
  };
};

export interface IPatientPortalLinkTokenRepository {
  findByTokenForMagicLinkExchange(token: string): Promise<PatientPortalLinkTokenMagicLinkRow | null>;

  /** Marca uso de forma atômica; false se outro request já consumiu o token. */
  consumeSingleUseIfUnused(id: string, usedAt: Date): Promise<boolean>;

  createPortalLinkToken(params: {
    clientId: string;
    token: string;
    expiresAt: Date;
    singleUse: boolean;
  }): Promise<{ id: string }>;
}
