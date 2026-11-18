"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  removeAppScreenshot,
  reorderAppScreenshots,
  uploadAppScreenshot,
} from "@/features/apps/app/services/admin-app-upload.service";

/** Upload/remoção/reordenação de screenshots de um app já criado (modo edição). */
export function useAppScreenshotMutations() {
  const [removingId, setRemovingId] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async ({ appId, files }: { appId: string; files: File[] }) => {
      for (const file of files) {
        await uploadAppScreenshot(appId, file);
      }
    },
  });
  const removeMutation = useMutation({
    mutationFn: ({ appId, screenshotId }: { appId: string; screenshotId: string }) =>
      removeAppScreenshot(appId, screenshotId),
    onMutate: ({ screenshotId }) => setRemovingId(screenshotId),
    onSettled: () => setRemovingId(null),
  });
  const reorderMutation = useMutation({
    mutationFn: ({ appId, order }: { appId: string; order: string[] }) =>
      reorderAppScreenshots(appId, order),
  });

  return {
    uploadFiles: uploadMutation.mutateAsync,
    uploading: uploadMutation.isPending,
    remove: removeMutation.mutateAsync,
    removingId,
    reorder: reorderMutation.mutateAsync,
  };
}
