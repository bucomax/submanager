"use client";

import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { getAppScopedToken } from "@/features/apps/app/services/apps.service";

/** Token scoped do iframe app. Falha é não-crítica: o iframe funciona sem token. */
export function useAppScopedToken(appId: string) {
  const { mutateAsync, data } = useMutation({
    mutationFn: () => getAppScopedToken(appId),
  });

  const fetchToken = useCallback(async () => {
    try {
      await mutateAsync();
    } catch {
      // Non-critical — iframe works without token
    }
  }, [mutateAsync]);

  return { scopedToken: data?.token ?? null, fetchToken };
}
