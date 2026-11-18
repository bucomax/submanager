import type { AuditRecordInput, IAuditRecorder } from "@/application/ports/audit-recorder.port";
import type { IDistributedLock, LockHandle } from "@/application/ports/distributed-lock.port";
import type { ITenantListCache } from "@/application/ports/tenant-list-cache.port";

/**
 * Transação em memória: o callback opera sobre uma cópia do estado; só vira o estado real no commit.
 * Exceção no callback = rollback (descarta a cópia). Suficiente para provar atomicidade nos testes.
 */
export async function runInMemoryTransaction<S, R>(
  holder: { state: S },
  fn: (draft: S) => Promise<R>,
): Promise<R> {
  const draft = structuredClone(holder.state);
  const result = await fn(draft);
  holder.state = draft;
  return result;
}

export type AuditLog = { audits: AuditRecordInput[] };

export function auditRecorderFor(log: AuditLog): IAuditRecorder {
  return {
    async record(input) {
      log.audits.push(input);
    },
  };
}

export class FakeDistributedLock implements IDistributedLock {
  readonly held = new Set<string>();
  /** Chaves que outro processo já detém (acquire devolve `null`). */
  readonly heldByOthers = new Set<string>();

  async acquire(key: string): Promise<LockHandle | null> {
    if (this.heldByOthers.has(key)) return null;
    this.held.add(key);
    return { release: async () => void this.held.delete(key) };
  }
}

export class FakeTenantListCache implements ITenantListCache {
  readonly clientsListRevalidated: string[] = [];
  readonly pathwaysAndClientsRevalidated: string[] = [];
  readonly opmeSuppliersRevalidated: string[] = [];

  revalidateClientsList(tenantId: string): void {
    this.clientsListRevalidated.push(tenantId);
  }

  revalidatePathwaysAndClientsLists(tenantId: string): void {
    this.pathwaysAndClientsRevalidated.push(tenantId);
  }

  revalidateOpmeSuppliersList(tenantId: string): void {
    this.opmeSuppliersRevalidated.push(tenantId);
  }
}
