import { unstable_cache } from "next/cache";
import { prisma } from "@/infrastructure/database/prisma";
import { tenantClientsListTag } from "@/infrastructure/cache/cache-tags";
import type { TenantMembershipClientScope } from "@/domain/client/client-visibility";
import { mergeClientWhereWithVisibility } from "@/infrastructure/visibility/client-visibility-where";

const TAKE = 200;

type Row = {
  id: string;
  client: { id: string; name: string; phone: string };
  pathway: { id: string; name: string };
  currentStage: { id: string; name: string; stageKey: string };
  currentStageAssignee: { id: string; name: string | null; email: string } | null;
  enteredStageAt: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Listagem de `PatientPathway` ativos (até 200) — invalida junto com a tag da lista de clientes
 * (transição / encerramento / nova jornada já chamam `revalidateTenantClientsList`).
 */
export async function getCachedPatientPathwaysList(input: {
  tenantId: string;
  viewerUserId: string;
  globalRole: string;
  scope: TenantMembershipClientScope;
}): Promise<{ patientPathways: Row[] }> {
  const { tenantId, viewerUserId, globalRole, scope } = input;

  const cacheKey = [
    "patient-pathways-list-v1",
    tenantId,
    viewerUserId,
    globalRole,
    scope.role,
    String(scope.restrictedToAssignedOnly),
    scope.linkedOpmeSupplierId ?? "none",
  ];

  return unstable_cache(
    async () => {
      const clientVisibilityWhere = mergeClientWhereWithVisibility(
        { deletedAt: null },
        scope,
        viewerUserId,
      );

      const rows = await prisma.patientPathway.findMany({
        where: {
          tenantId,
          completedAt: null,
          client: { is: clientVisibilityWhere },
        },
        orderBy: { updatedAt: "desc" },
        include: {
          client: { select: { id: true, name: true, phone: true } },
          pathway: { select: { id: true, name: true } },
          currentStage: { select: { id: true, name: true, stageKey: true } },
          currentStageAssignee: { select: { id: true, name: true, email: true } },
        },
        take: TAKE,
      });

      return {
        patientPathways: rows.map((r) => ({
          id: r.id,
          client: r.client,
          pathway: r.pathway,
          currentStage: r.currentStage,
          currentStageAssignee: r.currentStageAssignee
            ? {
                id: r.currentStageAssignee.id,
                name: r.currentStageAssignee.name,
                email: r.currentStageAssignee.email,
              }
            : null,
          enteredStageAt: r.enteredStageAt.toISOString(),
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        })),
      };
    },
    cacheKey,
    {
      revalidate: 30,
      tags: [tenantClientsListTag(tenantId)],
    },
  )();
}
