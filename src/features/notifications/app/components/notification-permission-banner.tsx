"use client";

import { Bell, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";

const DISMISSED_KEY = "submanager:notification-permission-dismissed";

export function NotificationPermissionBanner() {
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
        <Bell className="size-4 shrink-0 text-blue-500" />
        <p className="text-sm text-foreground truncate">
          Ative as notificacoes do navegador para ser alertado quando algo precisar da sua atencao.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="default" size="sm" onClick={handleEnable}>
          Ativar
        </Button>
        <Button variant="ghost" size="icon" className="size-7" onClick={handleDismiss}>
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
