-- Tokens passam a ser guardados como sha256 hex (o valor cru só existe no link enviado).
-- Converte os tokens já emitidos para que convites, resets e links mágicos pendentes
-- continuem funcionando após o deploy. Mesmo algoritmo do app: sha256(utf8) em hex.
UPDATE "UserAuthToken" SET "token" = encode(sha256(convert_to("token", 'UTF8')), 'hex');
UPDATE "PatientPortalLinkToken" SET "token" = encode(sha256(convert_to("token", 'UTF8')), 'hex');

-- AlterEnum: usuário existente adicionado a um tenant (aviso + trilha de auditoria)
ALTER TYPE "AuditEventType" ADD VALUE 'TENANT_MEMBER_ADDED';
