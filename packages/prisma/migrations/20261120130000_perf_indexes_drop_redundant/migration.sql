-- Índices para listagens/agregações quentes e remoção de índices redundantes (prefixo já coberto).
-- Sem CONCURRENTLY (Prisma executa a migration em transação); lock_timeout evita fila de locks atrás de DDL.
SET LOCAL lock_timeout = '5s';

-- StageTransition: dashboard filtra `createdAt >= since` sempre via join com PatientPathway
-- (`pp.tenantId = ?`, ver dashboard-home.repository.ts). O planner parte de PatientPathway por tenant e entra
-- em StageTransition por (patientPathwayId, createdAt); índice isolado em "createdAt" varreria todos os tenants
-- e não é necessário. O composto também cobre o antigo (patientPathwayId).
CREATE INDEX IF NOT EXISTS "StageTransition_patientPathwayId_createdAt_idx" ON "StageTransition"("patientPathwayId", "createdAt");
DROP INDEX IF EXISTS "StageTransition_patientPathwayId_idx";

-- Notification: lista completa (sem filtro de readAt) ordenada por createdAt DESC por usuário/tenant.
CREATE INDEX IF NOT EXISTS "Notification_userId_tenantId_createdAt_idx" ON "Notification"("userId", "tenantId", "createdAt" DESC);

-- AuditEvent: listagem do tenant sem clientId (o índice existente começa por tenantId, clientId e não ordena por createdAt).
CREATE INDEX IF NOT EXISTS "AuditEvent_tenantId_createdAt_idx" ON "AuditEvent"("tenantId", "createdAt" DESC);

-- AgendaEvent: sweep diário de lembrete de cirurgia varre todos os tenants por janela de startsAt.
-- Índice parcial: Prisma não o representa no schema (e o ignora no migrate diff).
CREATE INDEX IF NOT EXISTS "AgendaEvent_startsAt_cirurgia_idx" ON "AgendaEvent"("startsAt") WHERE "type" = 'cirurgia';

-- Redundantes: cada (tenantId) isolado é prefixo de um composto/unique que permanece.
-- Client: (tenantId, deletedAt)
DROP INDEX IF EXISTS "Client_tenantId_idx";
-- FileAsset: (tenantId, clientId, patientPortalReviewStatus)
DROP INDEX IF EXISTS "FileAsset_tenantId_idx";
-- QuickPhrase: unique (tenantId, slug)
DROP INDEX IF EXISTS "QuickPhrase_tenantId_idx";
-- PatientSelfRegisterInvite: (tenantId, clientId)
DROP INDEX IF EXISTS "PatientSelfRegisterInvite_tenantId_idx";
-- PatientPathwayChecklistItem: unique (patientPathwayId, checklistItemId)
DROP INDEX IF EXISTS "PatientPathwayChecklistItem_patientPathwayId_idx";
