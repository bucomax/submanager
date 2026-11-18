"use client";

import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { settingsKeys } from "@/features/settings/app/hooks/query-keys";
import { createOpmeSupplier } from "@/features/settings/app/services/tenant-settings.service";

export function useCreateOpmeSupplier() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (name: string) => createOpmeSupplier(name),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: settingsKeys.opmeAll }),
        queryClient.invalidateQueries({ queryKey: settingsKeys.pickers }),
      ]),
  });
  const { mutateAsync } = mutation;

  const submitCreateOpmeSupplier = useCallback((name: string) => mutateAsync(name), [mutateAsync]);

  return {
    creating: mutation.isPending,
    submitCreateOpmeSupplier,
  };
}
