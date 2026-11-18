"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isQueryLoading } from "@/shared/utils/query-loading";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

import { settingsKeys } from "@/features/settings/app/hooks/query-keys";
import {
  getTenantNotificationSettings,
  updateTenantNotificationSettings,
} from "@/features/settings/app/services/tenant-settings.service";
import type { TenantNotificationSettingsDto } from "@/types/api/tenant-settings-v1";

const DEFAULT_PREFERENCES: TenantNotificationSettingsDto = {
  notifyCriticalAlerts: true,
  notifySurgeryReminders: true,
  notifyNewPatients: true,
  notifyWeeklyReport: true,
  notifyDocumentDelivery: true,
};

export function useTenantNotifications() {
  const t = useTranslations("settings.notifications");
  const { data: session, status: sessionStatus } = useSession();
  const queryClient = useQueryClient();

  const canEdit =
    session?.user?.tenantRole === "tenant_admin" || session?.user?.globalRole === "super_admin";

  const query = useQuery({
    queryKey: settingsKeys.notifications,
    queryFn: ({ signal }) => getTenantNotificationSettings({ signal }),
    enabled: sessionStatus === "authenticated",
    select: (response) => response.notifications,
  });
  const { refetch } = query;

  const saveMutation = useMutation({
    mutationFn: (input: TenantNotificationSettingsDto) => updateTenantNotificationSettings(input),
    onSuccess: (response) => queryClient.setQueryData(settingsKeys.notifications, response),
  });
  const { mutateAsync: saveAsync } = saveMutation;

  const reload = useCallback(async () => {
    await refetch();
  }, [refetch]);
  const savePreferences = useCallback(
    async (input: TenantNotificationSettingsDto) => (await saveAsync(input)).notifications,
    [saveAsync],
  );

  return {
    sessionStatus,
    preferences: query.data ?? DEFAULT_PREFERENCES,
    hasLoaded: query.data !== undefined,
    loading: isQueryLoading(query),
    error: query.error ? query.error.message || t("loadError") : null,
    saving: saveMutation.isPending,
    canEdit,
    reload,
    savePreferences,
  };
}
