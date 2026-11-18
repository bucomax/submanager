export type SelfRegisterInviteState = {
  usedAt: Date | null;
  expiresAt: Date;
  tenantIsActive: boolean;
};

/** Convite utilizável: não usado, não expirado e clínica ativa. */
export function isSelfRegisterInviteUsable(invite: SelfRegisterInviteState, now: Date): boolean {
  return invite.usedAt == null && invite.expiresAt > now && invite.tenantIsActive;
}
