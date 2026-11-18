import { defineKeys } from "@/shared/lib/query/query-keys";

const base = defineKeys("agenda");

export const agendaKeys = {
  ...base,
  range: (from: string, to: string) => base.scope("range", { from, to }),
};
