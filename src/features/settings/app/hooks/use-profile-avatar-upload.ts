"use client";

import { useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { settingsKeys } from "@/features/settings/app/hooks/query-keys";
import {
  ProfileAvatarValidationError,
  fetchProfileAvatarStorageState,
  uploadProfileAvatarToStorage,
} from "@/features/settings/app/services/profile-avatar-storage.service";
import { toast } from "@/lib/toast";

/** Estado do storage + upload do avatar. `upload` devolve a referência `gcs:` ou `null` (erro já notificado). */
export function useProfileAvatarUpload() {
  const t = useTranslations("settings.profile");

  const stateQuery = useQuery({
    queryKey: settingsKeys.avatarStorage,
    queryFn: ({ signal }) => fetchProfileAvatarStorageState({ signal }),
  });
  const uploadMutation = useMutation({ mutationFn: uploadProfileAvatarToStorage });
  const { mutateAsync } = uploadMutation;
  const storageState = stateQuery.data ?? null;

  const upload = useCallback(
    async (file: File): Promise<string | null> => {
      if (storageState === "unavailable") {
        toast.error(t("imageStorageUnavailable"));
        return null;
      }
      try {
        const url = await mutateAsync(file);
        toast.success(t("imageUploadSuccess"));
        return url;
      } catch (e) {
        if (e instanceof ProfileAvatarValidationError) {
          if (e.code === "INVALID_TYPE") {
            toast.error(t("imageInvalidType"));
          } else if (e.code === "TOO_LARGE") {
            toast.error(t("imageTooLarge", { maxMb: 5 }));
          }
        } else {
          toast.error(e instanceof Error ? e.message : t("imageUploadError"));
        }
        return null;
      }
    },
    [mutateAsync, storageState, t],
  );

  return { storageState, uploading: uploadMutation.isPending, upload };
}
