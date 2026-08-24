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

  if (!process.env.REDIS_URL?.trim()) {
    console.log(
      "[instrumentation] REDIS_URL not set – running in inline mode (no BullMQ worker)"
    );
    return;
  }

  // BullMQ worker is long-running; Vercel serverless não mantém processo dedicado.
  // Use Redis na API (filas) e rode o worker em outro host, ou DISABLE_NOTIFICATION_WORKER=true.
  if (
    process.env.VERCEL === "1" ||
    process.env.DISABLE_NOTIFICATION_WORKER === "true"
  ) {
    console.log(
      "[instrumentation] BullMQ worker skipped (Vercel/serverless or DISABLE_NOTIFICATION_WORKER)."
    );
    return;
  }

  const { startNotificationWorker } = await import(
    "@/infrastructure/queue/notification-worker"
  );
  const worker = startNotificationWorker();
  if (worker) {
    console.log("[instrumentation] BullMQ notification worker started");
  }

  const { startWhatsAppDispatchWorker } = await import(
    "@/infrastructure/queue/whatsapp-dispatch-worker"
  );
  const wppWorker = startWhatsAppDispatchWorker();
  if (wppWorker) {
    console.log("[instrumentation] BullMQ WhatsApp dispatch worker started");
  }

  const { startEmailDispatchWorker } = await import(
    "@/infrastructure/queue/email-dispatch-worker"
  );
  const emailWorker = startEmailDispatchWorker();
  if (emailWorker) {
    console.log("[instrumentation] BullMQ email dispatch worker started");
  }
}

/** Captura erro não tratado de Server Component, route handler e proxy. */
export const onRequestError = Sentry.captureRequestError;
