"use client";

import { useRelativeTime } from "@/features/notifications/app/hooks/use-relative-time";
import type { NotificationDto } from "@/features/notifications/app/types";
import { resolveNotificationUrl } from "@/features/notifications/app/utils/notification-url";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Bell,
  ClipboardCheck,
  ExternalLink,
  FileUp,
  Link2,
  UserPlus,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/shared/components/ui/button";

const TYPE_ICONS: Record<string, typeof Bell> = {
  sla_critical: AlertTriangle,
  sla_warning: AlertTriangle,
  stage_transition: Bell,
  new_patient: UserPlus,
  checklist_complete: ClipboardCheck,
  patient_portal_file_pending: FileUp,
  patient_portal_link_sent: Link2,
};

const TYPE_COLORS: Record<string, string> = {
  sla_critical: "text-destructive",
  sla_warning: "text-warning",
  stage_transition: "text-info",
  new_patient: "text-success",
  checklist_complete: "text-success",
  patient_portal_file_pending: "text-info",
  patient_portal_link_sent: "text-info",
};

type NotificationItemProps = {
  notification: NotificationDto;
  onMarkRead: (id: string) => void;
  onPanelClose?: () => void;
};

export function NotificationItem({ notification, onMarkRead, onPanelClose }: NotificationItemProps) {
  const t = useTranslations("notifications");
  const isUnread = !notification.readAt;
  const Icon = TYPE_ICONS[notification.type] ?? Bell;
  const iconColor = TYPE_COLORS[notification.type] ?? "text-muted-foreground";
  const relativeTime = useRelativeTime(notification.createdAt);
  const metadata = notification.metadata as Record<string, unknown> | null;
  const actionUrl = resolveNotificationUrl(notification.type, metadata);
  const showActionButton = Boolean(actionUrl);
  const wrapFullRowInLink = Boolean(actionUrl) && !showActionButton;

  const handleMarkRead = () => {
    if (isUnread) onMarkRead(notification.id);
  };

  const content = (
    <div
      className={cn(
        "flex items-start gap-3 p-3 transition-colors",
        isUnread ? "bg-accent/50" : "bg-transparent",
        "hover:bg-accent cursor-pointer",
      )}
      onClick={handleMarkRead}
      onKeyDown={
        showActionButton ? undefined : (e) => e.key === "Enter" && handleMarkRead()
      }
      role={showActionButton ? undefined : "button"}
      tabIndex={showActionButton ? undefined : 0}
    >
      <div className={cn("mt-0.5 shrink-0", iconColor)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm leading-snug", isUnread && "font-medium")}>
          {notification.title}
        </p>
        {notification.body && (
          <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
            {notification.body}
          </p>
        )}
        <p className="text-muted-foreground mt-1 text-[11px]">{relativeTime}</p>
      </div>
      {showActionButton && actionUrl ? (
        <Link
          href={actionUrl}
          aria-label={t("bell.openPatient")}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "text-muted-foreground hover:text-foreground mt-0.5 shrink-0",
          )}
          onClick={(e) => {
            e.stopPropagation();
            onPanelClose?.();
            if (isUnread) onMarkRead(notification.id);
          }}
        >
          <ExternalLink className="size-4" aria-hidden />
        </Link>
      ) : null}
      {isUnread && (
        <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-info" />
      )}
    </div>
  );

  if (wrapFullRowInLink && actionUrl) {
    return (
      <Link href={actionUrl} className="block" onClick={handleMarkRead}>
        {content}
      </Link>
    );
  }

  return content;
}
