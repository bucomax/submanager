"use client";

import { dashboardKeys } from "@/features/dashboard/app/hooks/query-keys";
import { clientKeys } from "@/features/clients/app/hooks/query-keys";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

/**
 * Invalida tudo que depende do cadastro/jornada de pacientes (lista, ficha, timeline e pipeline
 * do dashboard). Só queries ativas são refeitas; as demais são marcadas como stale.
 */
export function useInvalidateClientData() {
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: clientKeys.all }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.pipelineAll }),
      ]).then(() => undefined),
    [queryClient],
  );
}
