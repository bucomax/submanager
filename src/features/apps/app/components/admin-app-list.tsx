"use client";

import { useCallback, useEffect, useState } from "react";
import { notifyActiveAppsMenuInvalidated } from "@/features/apps/app/lib/invalidate-active-apps";
import { getAdminApps, deleteApp, publishApp } from "@/features/apps/app/services/admin-apps.service";
import { activateApp, deactivateApp, getActiveApps } from "@/features/apps/app/services/apps.service";
import { AdminAppStorePreviewDialog } from "@/features/apps/app/components/admin-app-store-preview-dialog";
import { AdminAppWizardDialog } from "@/features/apps/app/components/admin-app-wizard-dialog";
import { AppIcon } from "@/features/apps/app/components/app-icon";
import type { AppDto } from "@/types/api/apps-v1";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { Eye, EyeOff, Pencil, Plus, Power, PowerOff, Store, Trash2, Users } from "lucide-react";
import { useTranslations } from "next-intl";

export function AdminAppList() {
  const t = useTranslations("apps.admin");
  const tCat = useTranslations("apps.catalog.categories");
  const [apps, setApps] = useState<AppDto[]>([]);
  const [activeSlugs, setActiveSlugs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [togglingAppId, setTogglingAppId] = useState<string | null>(null);

  // Wizard dialog state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<AppDto | null>(null);
  const [previewApp, setPreviewApp] = useState<AppDto | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [data, active] = await Promise.all([getAdminApps(), getActiveApps()]);
      setApps(data);
      setActiveSlugs(new Set(active.map((a) => a.slug)));
    } catch {
      // apiClient trata toast
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function openCreate() {
    setEditingApp(null);
    setWizardOpen(true);
  }

  function openEdit(app: AppDto) {
    setEditingApp(app);
    setWizardOpen(true);
  }

  async function handleTogglePublish(app: AppDto) {
    await publishApp(app.id, !app.isPublished);
    void refresh();
  }

  async function handleToggleActivate(app: AppDto) {
    setTogglingAppId(app.id);
    try {
      if (activeSlugs.has(app.slug)) {
        await deactivateApp(app.id);
      } else {
        await activateApp(app.id);
      }
      notifyActiveAppsMenuInvalidated();
      await refresh();
    } finally {
      setTogglingAppId(null);
    }
  }

  async function handleDelete(app: AppDto) {
    if (!window.confirm(t("deleteConfirm"))) return;
    try {
      await deleteApp(app.id);
      void refresh();
    } catch {
      // apiClient trata toast
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("title")}</CardTitle>
              <CardDescription>{t("description")}</CardDescription>
            </div>
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-3.5" />
              {t("newApp")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : apps.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("noApps")}</p>
          ) : (
            <div className="divide-y">
              {apps.map((app) => (
                <div key={app.id} className="flex items-center gap-4 py-3">
                  <AppIcon iconUrl={app.iconUrl} accentColor={app.accentColor} size="md" />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{app.name}</span>
                      <Badge
                        variant={app.isPublished ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {app.isPublished ? t("published") : t("draft")}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {tCat(app.category)}
                      </Badge>
                      {activeSlugs.has(app.slug) && (
                        <Badge variant="outline" className="border-emerald-700 text-xs text-emerald-600">
                          {t("active")}
                        </Badge>
                      )}
                      {app.accentColor && (
                        <span
                          className="size-3 rounded-full border border-foreground/10"
                          style={{ backgroundColor: app.accentColor }}
                          title={app.accentColor}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {app.tagline && (
                        <p className="truncate text-xs text-muted-foreground">{app.tagline}</p>
                      )}
                      {(app as AppDto & { activeTenantCount?: number }).activeTenantCount != null &&
                        (app as AppDto & { activeTenantCount?: number }).activeTenantCount! > 0 && (
                          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                            <Users className="size-3" />
                            {(app as AppDto & { activeTenantCount?: number }).activeTenantCount}
                          </span>
                        )}
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setPreviewApp(app)}
                            aria-label={t("preview.view")}
                          />
                        }
                      >
                        <Store className="size-4" />
                      </TooltipTrigger>
                      <TooltipContent>{t("preview.viewTooltip")}</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(app)}
                          />
                        }
                      >
                        <Pencil className="size-4" />
                      </TooltipTrigger>
                      <TooltipContent>{t("editApp")}</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => void handleTogglePublish(app)}
                          />
                        }
                      >
                        {app.isPublished ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </TooltipTrigger>
                      <TooltipContent>
                        {app.isPublished ? t("unpublish") : t("publish")}
                      </TooltipContent>
                    </Tooltip>

                    {(app.isPublished || activeSlugs.has(app.slug)) && (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={togglingAppId === app.id}
                              onClick={() => void handleToggleActivate(app)}
                            />
                          }
                        >
                          {activeSlugs.has(app.slug) ? (
                            <PowerOff className="size-4" />
                          ) : (
                            <Power className="size-4" />
                          )}
                        </TooltipTrigger>
                        <TooltipContent>
                          {activeSlugs.has(app.slug) ? t("deactivate") : t("activate")}
                        </TooltipContent>
                      </Tooltip>
                    )}

                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => void handleDelete(app)}
                          />
                        }
                      >
                        <Trash2 className="size-4" />
                      </TooltipTrigger>
                      <TooltipContent>{t("deleteApp")}</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AdminAppWizardDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        editApp={editingApp}
        onSaved={() => {
          notifyActiveAppsMenuInvalidated();
          void refresh();
        }}
      />

      <AdminAppStorePreviewDialog
        app={previewApp}
        open={previewApp != null}
        onOpenChange={(o) => {
          if (!o) setPreviewApp(null);
        }}
      />
    </>
  );
}
