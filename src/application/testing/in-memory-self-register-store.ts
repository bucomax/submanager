import type {
  IPatientSelfRegisterStore,
  ISelfRegisterNotifier,
  ISelfRegisterTx,
  SelfRegisterClientFields,
  SelfRegisterInvitePreviewRow,
  SelfRegisterInviteRow,
} from "@/application/ports/patient-self-register.port";
import type { AuditEventTypeName } from "@/domain/audit/audit-event-type";
import { TransactionConflictError } from "@/domain/errors/transaction-conflict";
import {
  auditRecorderFor,
  runInMemoryTransaction,
  type AuditLog,
} from "@/application/testing/in-memory-unit-of-work";

export type FakeSelfRegisterClient = {
  id: string;
  tenantId: string;
  deletedAt: Date | null;
  fields: Partial<SelfRegisterClientFields>;
  portalPasswordHash: string | null;
};

export type SelfRegisterState = AuditLog & {
  invites: (SelfRegisterInviteRow & { token: string })[];
  clients: FakeSelfRegisterClient[];
};

export class InMemorySelfRegisterStore implements IPatientSelfRegisterStore {
  state: SelfRegisterState = { invites: [], clients: [], audits: [] };
  previewRows: Record<string, SelfRegisterInvitePreviewRow> = {};
  /** Fault injection: a gravação desse tipo de audit falha (prova atomicidade). */
  failAuditOn: AuditEventTypeName | null = null;
  /** Fault injection: o commit falha por conflito de serialização. */
  conflictOnCommit = false;
  private nextId = 1;

  async findInviteForPreview(token: string) {
    return this.previewRows[token] ?? null;
  }

  async runSerializable<T>(fn: (tx: ISelfRegisterTx) => Promise<T>): Promise<T> {
    const result = await runInMemoryTransaction(this, async (draft) => {
      const value = await fn(this.createTx(draft));
      if (this.conflictOnCommit) throw new TransactionConflictError();
      return value;
    });
    return result;
  }

  private createTx(s: SelfRegisterState): ISelfRegisterTx {
    const audit = auditRecorderFor(s);
    return {
      audit: {
        record: async (input) => {
          if (input.type === this.failAuditOn) throw new Error("audit write failed");
          await audit.record(input);
        },
      },
      findInviteByToken: async (token) => s.invites.find((i) => i.token === token) ?? null,
      findActiveClient: async (tenantId, clientId) => {
        const c = s.clients.find((x) => x.id === clientId && x.tenantId === tenantId && !x.deletedAt);
        return c ? { id: c.id } : null;
      },
      updateClient: async (clientId, fields, credentials) => {
        const c = s.clients.find((x) => x.id === clientId)!;
        c.fields = fields;
        c.portalPasswordHash = credentials.portalPasswordHash;
        return { id: c.id, name: String(fields.name) };
      },
      createClient: async (tenantId, fields, credentials) => {
        const c = {
          id: `client-${this.nextId++}`,
          tenantId,
          deletedAt: null,
          fields,
          portalPasswordHash: credentials.portalPasswordHash,
        };
        s.clients.push(c);
        return { id: c.id, name: String(fields.name) };
      },
      markInviteUsed: async (inviteId, usedAt) => {
        s.invites.find((i) => i.id === inviteId)!.usedAt = usedAt;
      },
    };
  }
}

export class FakeSelfRegisterNotifier implements ISelfRegisterNotifier {
  readonly staff: Parameters<ISelfRegisterNotifier["notifyStaffPatientSelfRegistered"]>[0][] = [];
  readonly welcome: Parameters<ISelfRegisterNotifier["notifyPatientWelcome"]>[0][] = [];

  async notifyStaffPatientSelfRegistered(input: (typeof this.staff)[number]) {
    this.staff.push(input);
  }

  async notifyPatientWelcome(input: (typeof this.welcome)[number]) {
    this.welcome.push(input);
  }
}
