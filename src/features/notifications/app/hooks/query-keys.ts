import { defineKeys } from "@/shared/lib/query/query-keys";

const base = defineKeys("notifications");

export const notificationKeys = {
  ...base,
  unreadCount: base.scope("unread-count"),
  list: base.scope("list"),
};
