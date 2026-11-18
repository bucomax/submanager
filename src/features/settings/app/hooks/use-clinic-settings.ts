"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isQueryLoading } from "@/shared/utils/query-loading";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

import { settingsKeys } from "@/features/settings/app/hooks/query-keys";
import {
  getTenantClinicSettings,
  updateTenantClinicSettings,
} from "@/features/settings/app/services/tenant-settings.service";

type ClinicSettingsInput = {
  name: string;
  taxId: string;
  phone: string;
  addressLine: string;
  city: string;
  postalCode: string;
  affiliatedHospitals: string;
};

export function useClinicSettings() {
  const t = useTranslations("settings.clinic");
  const { data: session, status: sessionStatus } = useSession();
  const queryClient = useQueryClient();

  const canEdit =
    session?.user?.tenantRole === "tenant_admin" || session?.user?.globalRole === "super_admin";

  const query = useQuery({
    queryKey: settingsKeys.clinic,
    queryFn: ({ signal }) => getTenantClinicSettings({ signal }),
    enabled: sessionStatus === "authenticated",
    select: (response) => response.tenant,
  });
  const { refetch } = query;

  const saveMutation = useMutation({
    mutationFn: (input: ClinicSettingsInput) =>
      updateTenantClinicSettings({
        name: input.name.trim(),
        taxId: input.taxId.trim() || null,
        phone: input.phone.trim() || null,
        addressLine: input.addressLine.trim() || null,
        city: input.city.trim() || null,
        postalCode: input.postalCode.trim() || null,
        affiliatedHospitals: input.affiliatedHospitals.trim() || null,
      }),
    onSuccess: (response) => queryClient.setQueryData(settingsKeys.clinic, response),
  });
  const { mutateAsync: saveAsync } = saveMutation;

  const reload = useCallback(async () => {
    await refetch();
  }, [refetch]);
  const saveClinicSettings = useCallback(
    async (input: ClinicSettingsInput) => (await saveAsync(input)).tenant,
    [saveAsync],
  );

  return {
    sessionStatus,
    tenant: query.data ?? null,
    // Sessão ainda carregando conta como loading: a query só dispara quando autenticada.
    loading: isQueryLoading(query),
    error: query.error ? query.error.message || t("loadError") : null,
    saving: saveMutation.isPending,
    canEdit,
    reload,
    saveClinicSettings,
  };
}
