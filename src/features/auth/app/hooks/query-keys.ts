import { defineKeys } from "@/shared/lib/query/query-keys";

const base = defineKeys("auth");

export const authKeys = {
  ...base,
  invitePreview: (token: string) => base.scope("invite-preview", token),
};
