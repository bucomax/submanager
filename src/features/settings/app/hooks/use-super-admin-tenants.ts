"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isQueryLoading } from "@/shared/utils/query-loading";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

import { settingsKeys } from "@/features/settings/app/hooks/query-keys";
import {
  createAdminTenant,
  listAdminTenants,
  patchAdminTenant,
} from "@/features/settings/app/services/admin-tenants.service";
import { setActiveTenant } from "@/shared/services/tenant.service";
import type { CreateAdminTenantRequestBody } from "@/types/api/admin-tenants-v1";

export function useSuperAdminTenants() {
  const t = useTranslations("settings.tenants");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, status: sessionStatus, update } = useSession();
  const [pendingTenantId, setPendingTenantId] = useState<string | null>(null);

  const isSuperAdmin = session?.user?.globalRole === "super_admin";
  const activeTenantId = session?.user?.tenantId ?? null;

  const query = useQuery({
    queryKey: settingsKeys.adminTenants,
    queryFn: ({ signal }) => listAdminTenants({ signal }),
    enabled: sessionStatus === "authenticated" && isSuperAdmin,
    select: (response) => response.tenants,
  });
  const { refetch } = query;

  const reload = useCallback(async () => {
    if (!isSuperAdmin) return;
    await refetch();
  }, [isSuperAdmin, refetch]);

  const switchTenant = useCallback(
    async (tenantId: string) => {
      if (tenantId === activeTenantId) return;
      setPendingTenantId(tenantId);
      try {
        await setActiveTenant(tenantId);
        await update();
        router.refresh();
      } finally {
        setPendingTenantId(null);
      }
    },
    [activeTenantId, router, update],
  );

  const patchMutation = useMutation({
    mutationFn: ({ tenantId, isActive }: { tenantId: string; isActive: boolean }) =>
      patchAdminTenant(tenantId, { isActive }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsKeys.adminTenants });
      await update();
      router.refresh();
    },
  });
  const { mutateAsync: patchAsync } = patchMutation;

  const createMutation = useMutation({
    mutationFn: (input: CreateAdminTenantRequestBody) =>
      createAdminTenant({
        name: input.name.trim(),
        slug: input.slug.trim(),
        taxId: input.taxId,
        phone: input.phone,
        addressLine: input.addressLine,
        city: input.city,
        postalCode: input.postalCode,
        admin: input.admin,
      }),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: settingsKeys.adminTenants });
      await switchTenant(response.tenant.id);
    },
  });
  const { mutateAsync: createAsync } = createMutation;

  const setTenantActive = useCallback(
    async (tenantId: string, isActive: boolean) => {
      await patchAsync({ tenantId, isActive });
    },
    [patchAsync],
  );
  const createTenant = useCallback(
    (input: CreateAdminTenantRequestBody) => createAsync(input),
    [createAsync],
  );

  const sortedTenants = useMemo(
    () => [...(query.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [query.data],
  );

  return {
    sessionStatus,
    isSuperAdmin,
    activeTenantId,
    tenants: sortedTenants,
    // Não-super_admin nunca carrega: loading só vale quando a query está habilitada.
    loading: isSuperAdmin ? isQueryLoading(query) : false,
    error: query.error ? query.error.message || t("loadError") : null,
    pendingTenantId,
    pendingPatchTenantId: patchMutation.isPending ? patchMutation.variables.tenantId : null,
    creating: createMutation.isPending,
    reload,
    switchTenant,
    setTenantActive,
    createTenant,
  };
}
