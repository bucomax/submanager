import type { SlaHealthStatus } from "@/domain/pathway/sla-health";

/**
 * Classes Tailwind para cartão de paciente no Kanban por `SlaHealthStatus`.
 * O valor de `status` deve ser o mesmo domínio de {@link computeSlaHealthStatus} (`lib/pathway/sla-health`),
 * usado nas rotas `/kanban` e afins.
 */
export function slaHealthKanbanCardClassName(status: SlaHealthStatus): string {
  // Kit: cartão neutro com filete de 3 px na cor do prazo (a palavra fica no selo do cartão).
  if (status === "danger") {
    return "border-l-[3px] border-l-destructive";
  }
  if (status === "warning") {
    return "border-l-[3px] border-l-warning";
  }
  return "border-l-[3px] border-l-success";
}

/** Pill compacta (lista/tabela) alinhada a {@link slaHealthKanbanCardClassName}. */
export function slaHealthPillClassName(status: SlaHealthStatus): string {
  if (status === "danger") {
    return "bg-destructive-soft text-destructive";
  }
  if (status === "warning") {
    return "bg-warning-soft text-warning";
  }
  return "bg-success-soft text-success";
}
