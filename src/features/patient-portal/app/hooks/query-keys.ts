import { defineKeys } from "@/shared/lib/query/query-keys";

const base = defineKeys("patient-portal");

/** Todas as keys incluem o `tenantSlug`: o portal público não passa pela troca de tenant do painel. */
export const patientPortalKeys = {
  all: base.all,
  overview: (tenantSlug: string) => base.scope("overview", tenantSlug),
  detail: (tenantSlug: string) => base.scope("detail", tenantSlug),
  timeline: (tenantSlug: string, page: number) => base.scope("timeline", tenantSlug, page),
  timelineAll: (tenantSlug: string) => base.scope("timeline", tenantSlug),
  files: (tenantSlug: string, page: number) => base.scope("files", tenantSlug, page),
  filesAll: (tenantSlug: string) => base.scope("files", tenantSlug),
};
