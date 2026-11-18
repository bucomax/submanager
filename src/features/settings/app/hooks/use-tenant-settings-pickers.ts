"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { settingsKeys } from "@/features/settings/app/hooks/query-keys";
import {
  listOpmeSuppliers,
  listTenantMembersForPicker,
} from "@/features/settings/app/services/tenant-settings.service";

type UseTenantSettingsPickersOptions = {
  enabled?: boolean;
  fallbackErrorMessage: string;
};

type TenantMemberPicker = {
  userId: string;
  name: string | null;
  email: string;
};

type OpmeSupplierPicker = {
  id: string;
  name: string;
};

type PickersData = {
  members: TenantMemberPicker[];
  suppliers: OpmeSupplierPicker[];
};

export function useTenantSettingsPickers({
  enabled = true,
  fallbackErrorMessage,
}: UseTenantSettingsPickersOptions) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: settingsKeys.pickers,
    queryFn: async ({ signal }): Promise<PickersData> => {
      const [memberResponse, supplierResponse] = await Promise.all([
        listTenantMembersForPicker({ signal }),
        listOpmeSuppliers({ limit: 100 }, { signal }),
      ]);
      return {
        members: memberResponse.members,
        suppliers: supplierResponse.data.map((supplier) => ({ id: supplier.id, name: supplier.name })),
      };
    },
    enabled,
  });
  const { refetch } = query;

  const reload = useCallback(async () => {
    if (!enabled) return;
    await refetch();
  }, [enabled, refetch]);

  const appendSupplier = useCallback(
    (supplier: OpmeSupplierPicker) => {
      queryClient.setQueryData<PickersData>(settingsKeys.pickers, (prev) =>
        prev ? { ...prev, suppliers: [...prev.suppliers, supplier] } : prev,
      );
    },
    [queryClient],
  );

  // Falha deixa as listas vazias (como antes), com a mensagem em `error`.
  const failed = query.isError;
  return {
    members: query.data?.members ?? (failed ? [] : null),
    suppliers: query.data?.suppliers ?? (failed ? [] : null),
    error: query.error ? query.error.message || fallbackErrorMessage : null,
    reload,
    appendSupplier,
  };
}
