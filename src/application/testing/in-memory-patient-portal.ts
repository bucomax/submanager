import type { IPortalLoginClientFinder } from "@/application/ports/patient-portal-login-client.port";
import type { IPatientPortalLoginLockout } from "@/application/ports/patient-portal-login-lockout.port";
import type { IPortalOtpDelivery } from "@/application/ports/patient-portal-otp-delivery.port";
import type { IPatientPortalOtpRepository } from "@/application/ports/patient-portal-otp-repository.port";
import type { PortalClientForLogin } from "@/types/api/patient-portal-v1";

export type FakeOtpChallenge = {
  id: string;
  clientId: string;
  tenantId: string;
  codeHash: string;
  attempts: number;
  consumedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
};

/** Mesma semântica atômica do repo Prisma (`updateMany` condicional): reserva/consome sem await entre check e write. */
export class InMemoryPatientPortalOtpRepository implements IPatientPortalOtpRepository {
  challenges: FakeOtpChallenge[] = [];
  private nextId = 1;

  async countRecentChallenges(clientId: string, since: Date) {
    return this.challenges.filter((c) => c.clientId === clientId && c.createdAt >= since).length;
  }

  async createChallenge(params: { clientId: string; tenantId: string; codeHash: string; expiresAt: Date }) {
    this.challenges.push({
      id: `challenge-${this.nextId++}`,
      ...params,
      attempts: 0,
      consumedAt: null,
      createdAt: new Date(),
    });
  }

  async findLatestActiveChallenge(clientId: string, tenantId: string) {
    const active = this.challenges
      .filter((c) => c.clientId === clientId && c.tenantId === tenantId && !c.consumedAt && c.expiresAt > new Date())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))[0];
    return active ? { id: active.id, codeHash: active.codeHash, attempts: active.attempts } : null;
  }

  async reserveChallengeAttempt(id: string, maxAttempts: number) {
    const c = this.challenges.find((x) => x.id === id);
    if (!c || c.consumedAt || c.attempts >= maxAttempts) return false;
    c.attempts += 1;
    return true;
  }

  async consumeChallengeIfPending(id: string) {
    const c = this.challenges.find((x) => x.id === id);
    if (!c || c.consumedAt) return false;
    c.consumedAt = new Date();
    return true;
  }
}

/** Contador + bloqueio com a mesma regra do repo Prisma. */
export class InMemoryLoginLockout implements IPatientPortalLoginLockout {
  failed = 0;
  lockedUntil: Date | null = null;

  async isLocked(_clientId: string, now: Date) {
    return this.lockedUntil !== null && this.lockedUntil > now;
  }

  async registerFailedAttempt(
    _clientId: string,
    p: { now: Date; maxFailures: number; lockMs: number },
  ) {
    if (this.lockedUntil === null || this.lockedUntil <= p.now) this.failed += 1;
    if (this.failed >= p.maxFailures) {
      this.lockedUntil = new Date(p.now.getTime() + p.lockMs);
      this.failed = 0;
      return true;
    }
    return false;
  }

  async resetFailedAttempts() {
    this.failed = 0;
    this.lockedUntil = null;
  }
}

export class FakePortalLoginClientFinder implements IPortalLoginClientFinder {
  client: PortalClientForLogin | null = null;

  async findForPortalLogin() {
    return this.client;
  }
}

export class FakePortalOtpDelivery implements IPortalOtpDelivery {
  canEmail = true;
  webhookConfigured = false;
  readonly emails: { recipients: string[]; code: string; clinicName: string }[] = [];
  readonly whatsapps: { phones: string[]; code: string }[] = [];

  async canSendEmail() {
    return this.canEmail;
  }

  isWhatsAppWebhookConfigured() {
    return this.webhookConfigured;
  }

  async sendEmailCode(input: { recipients: string[]; code: string; clinicName: string }) {
    this.emails.push(input);
  }

  async sendWhatsAppCode(input: { phones: string[]; code: string }) {
    this.whatsapps.push(input);
  }
}
