"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { settingsKeys } from "@/features/settings/app/hooks/query-keys";
import { isQueryLoading } from "@/shared/utils/query-loading";
import { getMe, patchMe } from "@/features/settings/app/services/profile.service";
import type { MeUser } from "@/features/settings/app/types/account";

export function useAccountProfile() {
  const t = useTranslations("settings.profile");
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: settingsKeys.profile,
    queryFn: ({ signal }) => getMe({ signal }),
  });
  const { refetch } = query;

  const saveMutation = useMutation({
    mutationFn: (values: { name: string; image?: string | null }) => patchMe(values),
    onSuccess: (nextUser) => {
      queryClient.setQueryData<MeUser>(settingsKeys.profile, (prev) =>
        prev
          ? {
              ...prev,
              name: nextUser.name,
              image: nextUser.image,
              imageUrl: nextUser.imageUrl,
              email: nextUser.email,
              globalRole: nextUser.globalRole,
              emailVerified: nextUser.emailVerified ?? null,
            }
          : prev,
      );
    },
  });
  const { mutateAsync: saveAsync } = saveMutation;

  const reload = useCallback(async () => {
    await refetch();
  }, [refetch]);
  const saveProfile = useCallback(
    async (values: { name: string; image?: string | null }) => {
      await saveAsync(values);
    },
    [saveAsync],
  );

  return {
    profile: query.data ?? null,
    loading: isQueryLoading(query),
    error: query.error ? query.error.message || t("loadError") : null,
    reload,
    saveProfile,
  };
}
