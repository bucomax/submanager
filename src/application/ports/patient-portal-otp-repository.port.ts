export interface IPatientPortalOtpRepository {
  countRecentChallenges(clientId: string, since: Date): Promise<number>;

  createChallenge(params: {
    clientId: string;
    tenantId: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<void>;

  findLatestActiveChallenge(
    clientId: string,
    tenantId: string,
  ): Promise<{ id: string; codeHash: string; attempts: number } | null>;

  /** Reserva atomicamente uma tentativa; false = limite atingido ou desafio consumido. */
  reserveChallengeAttempt(id: string, maxAttempts: number): Promise<boolean>;

  /** Consome atomicamente; false se outra requisição já consumiu. */
  consumeChallengeIfPending(id: string): Promise<boolean>;
}
