import { logger } from "@/lib/observability/logger";

import { closeRedisConnections } from "./redis-connection";

/** Cloud Run envia SIGKILL 10 s após o SIGTERM; sobra margem para o Next fechar o HTTP. */
const SHUTDOWN_TIMEOUT_MS = 8_000;

type ClosableWorker = { close: () => Promise<unknown> };

const SIGNALS = ["SIGTERM", "SIGINT"] as const;

/** Estado em `globalThis`: o HMR do dev recarrega o módulo e não pode empilhar listeners. */
const globalShutdown = globalThis as unknown as {
  __queueShutdown?: { workers: ClosableWorker[]; registered: boolean };
};

/** Fecha workers (aguardando jobs ativos até o timeout) e depois as conexões Redis. */
export async function drainQueues(workers: ClosableWorker[], timeoutMs = SHUTDOWN_TIMEOUT_MS): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });
  const closing = Promise.allSettled(workers.map((worker) => worker.close()));

  const outcome = await Promise.race([closing, timeout]);
  clearTimeout(timer);
  if (outcome === "timeout") {
    logger.warn("[queue-shutdown] workers did not close in time; forcing Redis disconnect", { timeoutMs });
  }
  await closeRedisConnections();
}

/**
 * Registra (uma única vez por processo) SIGTERM/SIGINT para drenar os workers BullMQ.
 * Chamadas seguintes só atualizam a lista de workers.
 *
 * O Next registra o próprio handler e encerra o processo quando o HTTP fecha. Se ninguém mais
 * escuta o sinal, este handler remove o comportamento padrão de sair — então encerra por conta própria.
 */
export function registerQueueShutdown(workers: ClosableWorker[]): void {
  const state = (globalShutdown.__queueShutdown ??= { workers: [], registered: false });
  state.workers = workers;
  if (state.registered) return;
  state.registered = true;

  let shuttingDown = false;
  for (const signal of SIGNALS) {
    process.once(signal, () => {
      if (shuttingDown) return;
      shuttingDown = true;
      // `once` já removeu este listener: o que sobrar para o sinal pertence ao Next.
      const othersHandleExit = process.listenerCount(signal) > 0;
      logger.info("[queue-shutdown] signal received, draining BullMQ workers", { signal });
      void drainQueues(state.workers).finally(() => {
        if (!othersHandleExit) process.exit(0);
      });
    });
  }
}
