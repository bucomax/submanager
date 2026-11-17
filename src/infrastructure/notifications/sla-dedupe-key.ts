export type SlaAlertLevel = "warning" | "critical";

/**
 * Chave de dedupe do alerta SLA: um alerta por nível a cada entrada na etapa.
 * Estável entre execuções do cron (diário ou mais frequente) e entre modos inline/fila.
 */
export function buildSlaDedupeKey(input: {
  patientPathwayId: string;
  stageId: string;
  enteredStageAt: Date;
  level: SlaAlertLevel;
}): string {
  return `sla|${input.patientPathwayId}|${input.stageId}|${input.enteredStageAt.getTime()}|${input.level}`;
}
