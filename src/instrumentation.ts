import * as Sentry from "@sentry/nextjs";
import { sentrySharedOptions } from "@/lib/observability/sentry-shared-options";

/**
 * O guard de `NEXT_RUNTIME` precisa ser a primeira instrução desta função, no
 * mesmo escopo dos `await import()` dos workers. O Next substitui a variável por
 * literal em cada bundle, e é isso que elimina a árvore do BullMQ do bundle de
 * edge — que não suporta `node:crypto`. Extrair os imports para outra função
 * quebra essa eliminação e o build passa a reclamar de `node-module-in-edge-runtime`.
 *
 * `Sentry.init` fica inline aqui em vez de num `sentry.server.config.ts` na raiz:
 * um arquivo a menos, e o init acontece antes de qualquer worker subir.
 *
 * Sem branch de edge de propósito — não há rota com `runtime = "edge"` no projeto
 * e o proxy do Next 16 roda em Node. Ao criar a primeira, adicionar o branch aqui.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  Sentry.init(sentrySharedOptions);

  // Import dinâmico dentro do guard: o logger puxa `node:crypto` (request-id) e não pode entrar no bundle de edge.
  const { logger } = await import("@/lib/observability/logger");

  // Em produção lança se faltar DATABASE_URL/NEXTAUTH_SECRET/URL pública (boot falha cedo, com nomes claros).
  const { validateRuntimeEnv } = await import("@/lib/config/env");
  validateRuntimeEnv();

  if (!process.env.REDIS_URL?.trim()) {
    logger.info("[instrumentation] REDIS_URL not set – running in inline mode (no BullMQ worker)");
    return;
  }

  // BullMQ worker is long-running; Vercel serverless não mantém processo dedicado.
  // Use Redis na API (filas) e rode o worker em outro host, ou DISABLE_NOTIFICATION_WORKER=true
  // (ex.: serviço web do Cloud Run com worker separado).
  // Emitters só enfileiram na Vercel com QUEUE_EXTERNAL_WORKER=1 (ver `isQueueConsumerAvailable`).
  if (
    process.env.VERCEL === "1" ||
    process.env.DISABLE_NOTIFICATION_WORKER === "true"
  ) {
    logger.info("[instrumentation] BullMQ worker skipped (Vercel/serverless or DISABLE_NOTIFICATION_WORKER).");
    return;
  }

  const { startNotificationWorker } = await import(
    "@/infrastructure/queue/notification-worker"
  );
  const workers: Array<{ close: () => Promise<unknown> }> = [];
  const worker = startNotificationWorker();
  if (worker) {
    workers.push(worker);
    logger.info("[instrumentation] BullMQ notification worker started");
  }

  const { startWhatsAppDispatchWorker } = await import(
    "@/infrastructure/queue/whatsapp-dispatch-worker"
  );
  const wppWorker = startWhatsAppDispatchWorker();
  if (wppWorker) {
    workers.push(wppWorker);
    logger.info("[instrumentation] BullMQ WhatsApp dispatch worker started");
  }

  const { startEmailDispatchWorker } = await import(
    "@/infrastructure/queue/email-dispatch-worker"
  );
  const emailWorker = startEmailDispatchWorker();
  if (emailWorker) {
    workers.push(emailWorker);
    logger.info("[instrumentation] BullMQ email dispatch worker started");
  }

  // SIGTERM/SIGINT: fecha workers e Redis (Cloud Run redeploy/scale-in) sem perder job em andamento.
  const { registerQueueShutdown } = await import("@/infrastructure/queue/queue-shutdown");
  registerQueueShutdown(workers);
}

/** Captura erro não tratado de Server Component, route handler e proxy. */
export const onRequestError = Sentry.captureRequestError;
