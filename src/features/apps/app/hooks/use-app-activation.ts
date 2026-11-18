"use client";

import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { notifyActiveAppsMenuInvalidated } from "@/features/apps/app/lib/invalidate-active-apps";
import { activateApp, deactivateApp } from "@/features/apps/app/services/apps.service";

export function useAppActivation(onSuccess?: () => void) {
  const activateMutation = useMutation({
    mutationFn: ({ appId, config }: { appId: string; config?: Record<string, unknown> }) =>
      activateApp(appId, config),
    onSuccess: () => {
      notifyActiveAppsMenuInvalidated();
      onSuccess?.();
    },
  });
  const deactivateMutation = useMutation({
    mutationFn: (appId: string) => deactivateApp(appId),
    onSuccess: () => {
      notifyActiveAppsMenuInvalidated();
      onSuccess?.();
    },
  });

  const { mutateAsync: activateAsync } = activateMutation;
  const { mutateAsync: deactivateAsync } = deactivateMutation;
  const activate = useCallback(
    (appId: string, config?: Record<string, unknown>) => activateAsync({ appId, config }),
    [activateAsync],
  );
  const deactivate = useCallback((appId: string) => deactivateAsync(appId), [deactivateAsync]);

  return {
    activate,
    deactivate,
    activating: activateMutation.isPending,
    deactivating: deactivateMutation.isPending,
  };
}
