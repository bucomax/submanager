"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isQueryLoading } from "@/shared/utils/query-loading";
import { getActiveApps } from "@/features/apps/app/services/apps.service";
import { ACTIVE_APPS_INVALIDATE_EVENT } from "@/features/apps/app/lib/invalidate-active-apps";
import { appKeys } from "@/features/apps/app/hooks/query-keys";

export function useActiveApps() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: appKeys.active,
    queryFn: ({ signal }) => getActiveApps({ signal }),
  });
  const { refetch } = query;

  useEffect(() => {
    const onInvalidate = () => {
      void queryClient.invalidateQueries({ queryKey: appKeys.active });
    };
    window.addEventListener(ACTIVE_APPS_INVALIDATE_EVENT, onInvalidate);
    return () => window.removeEventListener(ACTIVE_APPS_INVALIDATE_EVENT, onInvalidate);
  }, [queryClient]);

  // sidebar não deve quebrar: erro vira lista vazia (serviço já silencia o toast)
  return { apps: query.data ?? [], loading: isQueryLoading(query), refresh: refetch };
}
