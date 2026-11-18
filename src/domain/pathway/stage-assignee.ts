/**
 * Candidatos a responsável da etapa, em ordem de prioridade:
 * padrões da etapa (lista tem precedência sobre o legado singular), depois o responsável do cadastro.
 * Quem filtra por membership do tenant é o repositório (`pickFirstTenantMember`).
 */
export function stageAssigneeCandidates(
  stage: { defaultAssigneeUserIds: string[]; defaultAssigneeUserId: string | null },
  clientAssignedToUserId: string | null,
): string[] {
  const fromStage =
    stage.defaultAssigneeUserIds.length > 0
      ? stage.defaultAssigneeUserIds
      : stage.defaultAssigneeUserId
        ? [stage.defaultAssigneeUserId]
        : [];
  return clientAssignedToUserId ? [...fromStage, clientAssignedToUserId] : fromStage;
}
