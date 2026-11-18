export type LockHandle = { release: () => Promise<void> };

export interface IDistributedLock {
  /** `null` se outro processo detém o lock. Implementações podem ser fail-open (sem Redis). */
  acquire(key: string, ttlSec: number): Promise<LockHandle | null>;
}
