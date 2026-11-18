"use client";

import { clientKeys } from "@/features/clients/app/hooks/query-keys";
import {
  deleteClientFile,
  reviewPatientPortalClientFile,
} from "@/features/clients/app/services/clients.service";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type ReviewVariables = { fileId: string; decision: "approve" | "reject"; rejectReason?: string };

/** Exclusão e revisão (aprovar/recusar) de arquivos do paciente; refaz lista de arquivos e timeline. */
export function useClientFileMutations(clientId: string) {
  const queryClient = useQueryClient();
  const refreshFilesAndTimeline = () => {
    void queryClient.invalidateQueries({ queryKey: clientKeys.filesAll(clientId) });
    void queryClient.invalidateQueries({ queryKey: clientKeys.timelineAll(clientId) });
  };

  const remove = useMutation({
    mutationFn: (fileId: string) => deleteClientFile(clientId, fileId),
    onSuccess: refreshFilesAndTimeline,
  });

  const review = useMutation({
    mutationFn: ({ fileId, decision, rejectReason }: ReviewVariables) =>
      reviewPatientPortalClientFile(clientId, fileId, { decision, rejectReason }),
    onSuccess: refreshFilesAndTimeline,
  });

  return {
    deletingId: remove.isPending ? remove.variables : null,
    reviewingId: review.isPending ? review.variables.fileId : null,
    deleteFile: async (fileId: string) => {
      await remove.mutateAsync(fileId);
    },
    reviewFile: async (input: ReviewVariables) => {
      await review.mutateAsync(input);
    },
  };
}
