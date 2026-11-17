/**
 * Leituras agregadas para a home do dashboard (métricas + opções de fluxo).
 * Implementação: `DashboardHomePrismaRepository` em infrastructure.
 */
export type DashboardPathwayOptionRow = {
  id: string;
  name: string;
  versions: { id: string; version: number }[];
};

/** Contagem por dia civil (`YYYY-MM-DD` no fuso do dashboard), agregada no banco. */
export type DayCount = {
  day: string;
  count: number;
};

export interface IDashboardHomeRepository {
  fetchPathwayOptions(tenantId: string): Promise<DashboardPathwayOptionRow[]>;
  countActivePathways(tenantId: string): Promise<number>;
  countTransitionsSince(tenantId: string, since: Date): Promise<number>;
  countAwaitingAction(tenantId: string, staleThreshold: Date): Promise<number>;
  countCompletedSince(tenantId: string, since: Date): Promise<number>;
  countTransitionsByDay(tenantId: string, since: Date): Promise<DayCount[]>;
  /** Pathways distintos com ao menos uma transição desde `since`. */
  countPathwaysWithTransitionSince(tenantId: string, since: Date): Promise<number>;
  countCompletionsByDay(tenantId: string, since: Date): Promise<DayCount[]>;
  countStartsByDay(tenantId: string, since: Date): Promise<DayCount[]>;
}
