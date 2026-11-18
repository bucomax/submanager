"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isQueryLoading } from "@/shared/utils/query-loading";
import { useSession } from "next-auth/react";

import { settingsKeys } from "@/features/settings/app/hooks/query-keys";
import {
  getWhatsAppSettings,
  testWhatsAppConnection,
  updateWhatsAppSettings,
} from "@/features/settings/app/services/tenant-settings.service";
import type {
  UpdateWhatsAppSettingsRequestBody,
  WhatsAppSettingsDto,
} from "@/types/api/tenant-settings-v1";

const DEFAULT_SETTINGS: WhatsAppSettingsDto = {
  whatsappEnabled: false,
  whatsappPhoneNumberId: null,
  whatsappBusinessAccountId: null,
  hasAccessToken: false,
  whatsappVerifiedAt: null,
};

export function useWhatsAppSettings() {
  const { data: session, status: sessionStatus } = useSession();
  const queryClient = useQueryClient();

  const canEdit =
    session?.user?.tenantRole === "tenant_admin" ||
    session?.user?.globalRole === "super_admin";

  const query = useQuery({
    queryKey: settingsKeys.whatsapp,
    queryFn: ({ signal }) => getWhatsAppSettings({ signal }),
    enabled: sessionStatus === "authenticated",
    select: (response) => response.whatsapp,
  });
  const { refetch } = query;

  const saveMutation = useMutation({
    mutationFn: (input: UpdateWhatsAppSettingsRequestBody) => updateWhatsAppSettings(input),
    onSuccess: (response) => queryClient.setQueryData(settingsKeys.whatsapp, response),
  });
  const testMutation = useMutation({
    mutationFn: testWhatsAppConnection,
    // Recarrega para obter o whatsappVerifiedAt atualizado.
    onSuccess: (result) =>
      result.ok ? queryClient.invalidateQueries({ queryKey: settingsKeys.whatsapp }) : undefined,
  });
  const { mutateAsync: saveAsync } = saveMutation;
  const { mutateAsync: testAsync } = testMutation;

  const reload = useCallback(async () => {
    await refetch();
  }, [refetch]);
  const save = useCallback(
    async (input: UpdateWhatsAppSettingsRequestBody) => (await saveAsync(input)).whatsapp,
    [saveAsync],
  );
  const testConnection = useCallback(() => testAsync(), [testAsync]);

  return {
    sessionStatus,
    settings: query.data ?? DEFAULT_SETTINGS,
    hasLoaded: query.data !== undefined,
    loading: isQueryLoading(query),
    error: query.error ? query.error.message || "Erro ao carregar configurações." : null,
    saving: saveMutation.isPending,
    testing: testMutation.isPending,
    canEdit,
    reload,
    save,
    testConnection,
  };
}
