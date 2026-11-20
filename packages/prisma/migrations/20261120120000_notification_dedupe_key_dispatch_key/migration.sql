-- Dedupe atômico de notificações (SLA) e reserva de chaves de envio idempotente.
-- Postgres trata NULL como distinto em UNIQUE: linhas sem dedupeKey não colidem.
ALTER TABLE "Notification" ADD COLUMN "dedupeKey" TEXT;
CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key" ON "Notification"("userId", "dedupeKey");

CREATE TABLE "DispatchKey" (
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DispatchKey_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "DispatchKey_createdAt_idx" ON "DispatchKey"("createdAt");
