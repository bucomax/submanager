import { computeSlaHealthStatus } from "@/domain/pathway/sla-health";
import type { KanbanColumn, KanbanPatientPathway } from "@/features/dashboard/app/types";

/**
 * Resultado otimista de arrastar um paciente para outra etapa: remove da coluna de origem,
 * insere no topo do destino e recalcula o SLA. `null` quando o movimento é inválido/no-op.
 */
export function moveKanbanPatient(
  columns: KanbanColumn[],
  patientPathwayId: string,
  toStageId: string,
  now: Date,
): KanbanColumn[] | null {
  const sourceCol = columns.find((c) => c.data.some((p) => p.id === patientPathwayId));
  const targetCol = columns.find((c) => c.stage.id === toStageId);
  if (!sourceCol || !targetCol || sourceCol.stage.id === toStageId) return null;

  const patient = sourceCol.data.find((p) => p.id === patientPathwayId);
  if (!patient) return null;

  const enteredStageAt = now.toISOString();
  const updatedPatient: KanbanPatientPathway = {
    ...patient,
    enteredStageAt,
    updatedAt: enteredStageAt,
    currentStage: {
      id: targetCol.stage.id,
      stageKey: targetCol.stage.stageKey,
      name: targetCol.stage.name,
      sortOrder: targetCol.stage.sortOrder,
      alertWarningDays: targetCol.stage.alertWarningDays,
      alertCriticalDays: targetCol.stage.alertCriticalDays,
    },
    slaStatus: computeSlaHealthStatus(
      new Date(enteredStageAt),
      now,
      targetCol.stage.alertWarningDays,
      targetCol.stage.alertCriticalDays,
    ),
  };

  return columns.map((c) => {
    if (c.stage.id === sourceCol.stage.id) {
      return {
        ...c,
        data: c.data.filter((p) => p.id !== patientPathwayId),
        pagination: { ...c.pagination, totalItems: Math.max(0, c.pagination.totalItems - 1) },
      };
    }
    if (c.stage.id === toStageId) {
      return {
        ...c,
        data: [updatedPatient, ...c.data.filter((p) => p.id !== patientPathwayId)],
        pagination: { ...c.pagination, totalItems: c.pagination.totalItems + 1 },
      };
    }
    return c;
  });
}
