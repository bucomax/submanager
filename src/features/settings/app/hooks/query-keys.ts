import { defineKeys } from "@/shared/lib/query/query-keys";

const base = defineKeys("settings");

export const settingsKeys = {
  ...base,
  profile: base.scope("profile"),
  avatarStorage: base.scope("avatar-storage"),
  emailPreview: base.scope("email-preview"),
  clinic: base.scope("clinic"),
  notifications: base.scope("notifications"),
  whatsapp: base.scope("whatsapp"),
  smtp: base.scope("smtp"),
  emailDomain: base.scope("email-domain"),
  opmeAll: base.scope("opme"),
  opme: (params: { page: number; q: string | undefined }) => base.scope("opme", params),
  pickers: base.scope("pickers"),
  memberPicker: base.scope("member-picker"),
  adminTenants: base.scope("admin-tenants"),
  tenantMembers: (tenantId: string | null) => base.scope("tenant-members", tenantId),
  feedbackAll: base.scope("feedback"),
  feedback: (filters: object) => base.scope("feedback", filters),
};
