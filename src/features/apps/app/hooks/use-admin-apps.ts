"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifyActiveAppsMenuInvalidated } from "@/features/apps/app/lib/invalidate-active-apps";
import { appKeys } from "@/features/apps/app/hooks/query-keys";
import { deleteApp, getAdminApps, publishApp } from "@/features/apps/app/services/admin-apps.service";
import { activateApp, deactivateApp, getActiveApps } from "@/features/apps/app/services/apps.service";
import type { AppDto } from "@/types/api/apps-v1";

/** Lista admin de apps + slugs ativos no tenant, com ações de publicar/ativar/excluir. */
export function useAdminApps() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: appKeys.admin,
    queryFn: async ({ signal }) => {
      const [apps, active] = await Promise.all([
        getAdminApps({ signal }),
        getActiveApps({ signal }),
      ]);
      return { apps, activeSlugs: active.map((a) => a.slug) };
    },
  });

  const activeSlugs = useMemo(() => new Set(query.data?.activeSlugs ?? []), [query.data]);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: appKeys.admin });

  const publishMutation = useMutation({
    mutationFn: (app: AppDto) => publishApp(app.id, !app.isPublished),
    onSuccess: invalidate,
  });

  const toggleActivationMutation = useMutation({
    mutationFn: (app: AppDto) =>
      activeSlugs.has(app.slug) ? deactivateApp(app.id) : activateApp(app.id),
    onSuccess: async () => {
      notifyActiveAppsMenuInvalidated();
      await invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (app: AppDto) => deleteApp(app.id),
    onSuccess: invalidate,
  });

  return {
    apps: query.data?.apps ?? [],
    activeSlugs,
    loading: query.isPending,
    togglingAppId: toggleActivationMutation.isPending
      ? toggleActivationMutation.variables.id
      : null,
    togglePublish: publishMutation.mutateAsync,
    toggleActivation: toggleActivationMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    onSaved: () => {
      notifyActiveAppsMenuInvalidated();
      void invalidate();
    },
  };
}
