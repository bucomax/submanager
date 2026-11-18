"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isQueryLoading } from "@/shared/utils/query-loading";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

import { settingsKeys } from "@/features/settings/app/hooks/query-keys";
import {
  getTenantSmtpSettings,
  patchTenantSmtpSettings,
  postTestTenantSmtp,
} from "@/features/settings/app/services/tenant-smtp.service";
import type { TenantSmtpDto } from "@/types/api/tenant-smtp-v1";

const EMPTY: TenantSmtpDto = {
  smtpEnabled: false,
  smtpHost: null,
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: null,
  hasPassword: false,
  smtpFromName: null,
  smtpFromAddress: null,
};

export function useTenantSmtp() {
  const t = useTranslations("settings.email");
  const { data: session, status: sessionStatus } = useSession();
  const queryClient = useQueryClient();

  const canEdit =
    session?.user?.tenantRole === "tenant_admin" || session?.user?.globalRole === "super_admin";

  const query = useQuery({
    queryKey: settingsKeys.smtp,
    queryFn: ({ signal }) => getTenantSmtpSettings({ signal }),
    enabled: sessionStatus === "authenticated",
    select: (response) => response.smtp,
  });
  const { refetch } = query;

  const saveMutation = useMutation({
    mutationFn: (body: Parameters<typeof patchTenantSmtpSettings>[0]) => patchTenantSmtpSettings(body),
    onSuccess: (response) => queryClient.setQueryData(settingsKeys.smtp, response),
  });
  const testMutation = useMutation({
    mutationFn: (toOverride?: string) => postTestTenantSmtp(toOverride ? { to: toOverride } : {}),
  });
  const { mutateAsync: saveAsync } = saveMutation;
  const { mutateAsync: testAsync } = testMutation;

  const reload = useCallback(async () => {
    await refetch();
  }, [refetch]);
  const save = useCallback(
    async (body: Parameters<typeof patchTenantSmtpSettings>[0]) => {
      await saveAsync(body);
    },
    [saveAsync],
  );
  const test = useCallback(
    async (toOverride?: string) => {
      await testAsync(toOverride);
    },
    [testAsync],
  );

  return {
    sessionStatus,
    smtp: query.data ?? EMPTY,
    hasLoaded: query.data !== undefined,
    loading: isQueryLoading(query),
    error: query.error ? query.error.message || t("loadError") : null,
    busy: saveMutation.isPending || testMutation.isPending,
    canEdit,
    reload,
    save,
    test,
  };
}
