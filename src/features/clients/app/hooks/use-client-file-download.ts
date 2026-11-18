"use client";

import { requestFileDownloadPresign } from "@/features/clients/app/services/clients.service";
import { useMutation } from "@tanstack/react-query";

export function useClientFileDownload() {
  const mutation = useMutation({
    mutationFn: async (fileId: string) => {
      const { downloadUrl } = await requestFileDownloadPresign({ fileId });
      window.open(downloadUrl, "_blank", "noopener,noreferrer");
    },
  });

  return {
    downloadingId: mutation.isPending ? mutation.variables : null,
    openDownload: (fileId: string) => mutation.mutateAsync(fileId),
  };
}
