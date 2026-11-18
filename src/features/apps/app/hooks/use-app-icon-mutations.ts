"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  removeAppIcon,
  uploadAppIcon,
} from "@/features/apps/app/services/admin-app-upload.service";

/** Upload/remoção do ícone de um app já criado (modo edição). */
export function useAppIconMutations() {
  const [progress, setProgress] = useState(0);

  const uploadMutation = useMutation({
    mutationFn: ({ appId, file }: { appId: string; file: File }) => {
      setProgress(0);
      return uploadAppIcon(appId, file, setProgress);
    },
    onSettled: () => setProgress(0),
  });
  const removeMutation = useMutation({
    mutationFn: (appId: string) => removeAppIcon(appId),
  });

  return {
    upload: uploadMutation.mutateAsync,
    uploading: uploadMutation.isPending,
    progress,
    remove: removeMutation.mutateAsync,
    removing: removeMutation.isPending,
  };
}
