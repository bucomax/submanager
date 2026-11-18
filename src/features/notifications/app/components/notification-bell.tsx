"use client";

import { useNotifications } from "@/features/notifications/app/hooks/use-notifications";
import { NotificationPanel } from "./notification-panel";
import { Button } from "@/shared/components/ui/button";
import { Bell } from "lucide-react";

export function NotificationBell() {
  const {
    unreadCount,
    items,
    loading,
    isOpen,
    hasMore,
    canMarkAllRead,
    markAllReadPending,
    open,
    close,
    loadMore,
    markRead,
    markAllAsRead,
  } = useNotifications();

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-8 w-8"
        onClick={open}
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>
      <NotificationPanel
        open={isOpen}
        onClose={close}
        items={items}
        loading={loading}
        hasMore={hasMore}
        canMarkAllRead={canMarkAllRead}
        markAllReadPending={markAllReadPending}
        onLoadMore={loadMore}
        onMarkRead={markRead}
        onMarkAllRead={markAllAsRead}
      />
    </>
  );
}
