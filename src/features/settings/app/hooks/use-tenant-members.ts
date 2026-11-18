"use client";

import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

import { settingsKeys } from "@/features/settings/app/hooks/query-keys";
import {
  listTenantMembers,
  patchMemberRole,
  removeTenantMember,
} from "@/features/settings/app/services/members.service";
import type { TenantMemberRow, TenantRole } from "@/features/settings/app/types/account";

export function useTenantMembers() {
  const t = useTranslations("settings.members");
  const queryClient = useQueryClient();
  const { data: session, status } = useSession();
  const tenantId = session?.user?.tenantId ?? null;
  const tenantRole = session?.user?.tenantRole ?? null;
  const globalRole = session?.user?.globalRole ?? null;
  const currentUserId = session?.user?.id ?? null;
  const canManage = Boolean(
    tenantId && (tenantRole === "tenant_admin" || globalRole === "super_admin"),
  );
  const key = settingsKeys.tenantMembers(tenantId);

  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => listTenantMembers(tenantId!, { signal }),
    enabled: status === "authenticated" && canManage && Boolean(tenantId),
  });
  const { refetch } = query;

  const sortedRows = useMemo(() => {
    if (!query.data) return [];
    return [...query.data].sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
  }, [query.data]);

  const roleMutation = useMutation({
    mutationFn: ({ member, role }: { member: TenantMemberRow; role: TenantRole }) =>
      patchMemberRole(tenantId!, member.userId, role),
    onSuccess: (_data, { member, role }) =>
      queryClient.setQueryData<TenantMemberRow[]>(key, (prev) =>
        (prev ?? []).map((row) => (row.userId === member.userId ? { ...row, role } : row)),
      ),
  });
  const removeMutation = useMutation({
    mutationFn: (member: TenantMemberRow) => removeTenantMember(tenantId!, member.userId),
    onSuccess: (_data, member) =>
      queryClient.setQueryData<TenantMemberRow[]>(key, (prev) =>
        (prev ?? []).filter((row) => row.userId !== member.userId),
      ),
  });
  const { mutateAsync: roleAsync } = roleMutation;
  const { mutateAsync: removeAsync } = removeMutation;

  const reload = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const updateMemberRole = useCallback(
    async (member: TenantMemberRow, role: TenantRole) => {
      if (!tenantId || member.role === role) return;
      await roleAsync({ member, role });
    },
    [tenantId, roleAsync],
  );

  const deleteMember = useCallback(
    async (member: TenantMemberRow) => {
      if (!tenantId) return;
      await removeAsync(member);
    },
    [tenantId, removeAsync],
  );

  const busyId = roleMutation.isPending
    ? roleMutation.variables.member.userId
    : removeMutation.isPending
      ? removeMutation.variables.userId
      : null;

  return {
    sessionStatus: status,
    currentUserId,
    tenantId,
    canManage,
    // `null` enquanto não carregou; erro vira lista vazia (como antes).
    rows: query.data ?? (query.isError ? [] : null),
    sortedRows,
    error: query.error ? query.error.message || t("loadError") : null,
    busyId,
    reload,
    updateMemberRole,
    deleteMember,
  };
}
