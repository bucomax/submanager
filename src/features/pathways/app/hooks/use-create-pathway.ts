"use client";

import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { pathwayKeys } from "@/features/pathways/app/hooks/query-keys";
import { postPathway } from "@/features/pathways/app/services/pathways.service";
import type { CreatePathwayInput, CreatedPathway } from "@/features/pathways/app/types/pathways";

export function useCreatePathway() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: postPathway,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pathwayKeys.list }),
  });
  const { mutateAsync } = mutation;

  const createPathway = useCallback(
    (input: CreatePathwayInput): Promise<CreatedPathway> => mutateAsync(input),
    [mutateAsync],
  );

  return {
    creating: mutation.isPending,
    createPathway,
  };
}
