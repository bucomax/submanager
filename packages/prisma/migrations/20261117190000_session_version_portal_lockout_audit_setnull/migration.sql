-- User: versão de sessão (revoga JWTs após troca/redefinição de senha)
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- Client: bloqueio persistente de login por senha no portal (não depende de Redis)
ALTER TABLE "Client" ADD COLUMN "portalFailedLoginCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Client" ADD COLUMN "portalLockedUntil" TIMESTAMP(3);

-- AuditEvent: excluir Client não pode apagar a trilha de auditoria (LGPD / retenção)
ALTER TABLE "AuditEvent" DROP CONSTRAINT "AuditEvent_clientId_fkey";
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
