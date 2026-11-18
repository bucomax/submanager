import { defineKeys } from "@/shared/lib/query/query-keys";

const base = defineKeys("clients");

type ListKeyParams = {
  page: number;
  q: string;
  pathwayId: string;
  stageId: string;
  status: string;
};

/**
 * `detail(id)` é prefixo de timeline/files/notes do cliente: invalidar o detalhe
 * recarrega a ficha inteira (incluindo a timeline de auditoria).
 */
export const clientKeys = {
  all: base.all,
  list: (params: ListKeyParams) => base.scope("list", params),
  pathways: base.scope("pathways"),
  selfRegisterValidation: (token: string, tenantSlug: string | undefined) =>
    base.scope("self-register-validation", token, tenantSlug ?? ""),
  publishedStages: (pathwayId: string) => base.scope("published-stages", pathwayId),
  detail: (clientId: string) => base.scope("detail", clientId),
  timelineAll: (clientId: string) => base.scope("detail", clientId, "timeline"),
  filesAll: (clientId: string) => base.scope("detail", clientId, "files"),
  notesAll: (clientId: string) => base.scope("detail", clientId, "notes"),
  timeline: (clientId: string, params: { page: number; categories: string }) =>
    base.scope("detail", clientId, "timeline", params),
  files: (clientId: string, page: number) => base.scope("detail", clientId, "files", page),
  notes: (clientId: string, page: number) => base.scope("detail", clientId, "notes", page),
};
