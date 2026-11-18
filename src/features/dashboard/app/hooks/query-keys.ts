import { defineKeys } from "@/shared/lib/query/query-keys";

const base = defineKeys("dashboard");

export type DashboardPipelineKeyParams = {
  pathwayId: string;
  search: string;
  status: string;
  opmeSupplierId: string;
};

export type DashboardReportsKeyParams = {
  periodDays: number;
  pathwayId: string;
  opmeSupplierId: string;
  page: number;
};

export const dashboardKeys = {
  all: base.all,
  pipeline: (params: DashboardPipelineKeyParams) => base.scope("pipeline", params),
  pipelineAll: base.scope("pipeline"),
  opmeOptions: base.scope("opme-options"),
  reports: (params: DashboardReportsKeyParams) => base.scope("reports", params),
  reportPathwayOptions: base.scope("reports", "pathway-options"),
  changeStageDetail: (patientPathwayId: string) => base.scope("change-stage", patientPathwayId),
};
