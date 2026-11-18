import type { NotificationType } from "@prisma/client";

import { tenantPrismaRepository } from "@/infrastructure/repositories/tenant.repository";

function uniqueUserIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

async function listAllTenantMemberUserIds(tenantId: string): Promise<string[]> {
  return tenantPrismaRepository.listMembershipUserIds(tenantId);
}

async function listTenantAdminUserIds(tenantId: string): Promise<string[]> {
  return tenantPrismaRepository.listTenantAdminUserIds(tenantId);
}

async function isMemberOfTenant(tenantId: string, userId: string): Promise<boolean> {
  return tenantPrismaRepository.isUserMemberOfTenant(tenantId, userId);
}

/**
 * Fase 2: destinatários in-app para eventos ligados a uma instância de jornada (`PatientPathway`).
 *
 * - Com `currentStageAssigneeUserId` válido no tenant: normalmente só o responsável da etapa.
 * - `sla_critical`: responsável + todos os `tenant_admin` (deduplicado).
 * - `patient_portal_file_pending` / `patient_portal_link_sent` / `checklist_complete`: responsável + admins.
 * - Sem assignee ou ID inválido: todos os membros (comportamento legado).
 */
export async function resolvePathwayNotificationTargetUserIds(args: {
  tenantId: string;
  type: NotificationType;
  currentStageAssigneeUserId: string | null;
}): Promise<string[]> {
  const allMembers = await listAllTenantMemberUserIds(args.tenantId);
  const assigneeId = args.currentStageAssigneeUserId;
  if (!assigneeId) {
    return allMembers;
  }
  const ok = await isMemberOfTenant(args.tenantId, assigneeId);
  if (!ok) {
    return allMembers;
  }
  if (args.type === "sla_critical") {
    const admins = await listTenantAdminUserIds(args.tenantId);
    return uniqueUserIds([assigneeId, ...admins]);
  }
  if (
    args.type === "patient_portal_file_pending" ||
    args.type === "patient_portal_link_sent" ||
    args.type === "checklist_complete"
  ) {
    const admins = await listTenantAdminUserIds(args.tenantId);
    return uniqueUserIds([assigneeId, ...admins]);
  }
  return [assigneeId];
}
