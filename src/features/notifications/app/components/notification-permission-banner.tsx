"use client";

import { Bell, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";

const DISMISSED_KEY = "submanager:notification-permission-dismissed";

export function NotificationPermissionBanner() {
  const t = useTranslations("notifications.permissionBanner");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem(DISMISSED_KEY) === "1") return;
    // Delay to avoid layout shift during hydration
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleEnable = useCallback(async () => {
    const result = await Notification.requestPermission();
    if (result === "denied") {
      localStorage.setItem(DISMISSED_KEY, "1");
    }
    setVisible(false);
  }, []);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div className="bg-muted/60 border-b px-4 py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <Bell className="size-4 shrink-0 text-info" />
        <p className="text-sm text-foreground truncate">{t("message")}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="default" size="sm" onClick={handleEnable}>
          {t("enable")}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={handleDismiss}
          aria-label={t("dismiss")}
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
