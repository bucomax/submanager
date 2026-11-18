import { defineKeys } from "@/shared/lib/query/query-keys";

const base = defineKeys("apps");

export const appKeys = {
  ...base,
  catalog: (params?: { category?: string; search?: string }) =>
    base.scope("catalog", params ?? {}),
  catalogAll: base.scope("catalog"),
  detail: (appId: string | undefined) => base.scope("detail", appId),
  active: base.scope("active"),
  admin: base.scope("admin"),
};
