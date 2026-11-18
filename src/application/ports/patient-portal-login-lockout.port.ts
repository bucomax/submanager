/** Bloqueio persistente do login por senha do portal (atômico no banco; independe de Redis/instância). */
export interface IPatientPortalLoginLockout {
  isLocked(clientId: string, now: Date): Promise<boolean>;
  /** Registra uma senha errada; `true` quando ESTA chamada ativou o bloqueio. */
  registerFailedAttempt(
    clientId: string,
    params: { now: Date; maxFailures: number; lockMs: number },
  ): Promise<boolean>;
  /** Login bem-sucedido: limpa contador e bloqueio expirado. */
  resetFailedAttempts(clientId: string): Promise<void>;
}
