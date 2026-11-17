-- AlterEnum: super_admin entrando em tenant sem membership (ARCHITECTURE §5.5)
ALTER TYPE "AuditEventType" ADD VALUE 'SUPER_ADMIN_TENANT_ENTERED';
