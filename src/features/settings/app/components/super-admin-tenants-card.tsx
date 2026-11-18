"use client";

import { Check, Loader2, Plus, RefreshCw, ArrowRightLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { CreateTenantWizardDialog } from "@/features/settings/app/components/create-tenant-wizard-dialog";
import { useSuperAdminTenants } from "@/features/settings/app/hooks/use-super-admin-tenants";
import { toast } from "@/lib/toast";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Switch } from "@/shared/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function SuperAdminTenantsCard() {
  const t = useTranslations("settings.tenants");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardKey, setWizardKey] = useState(0);
  const {
    sessionStatus,
    isSuperAdmin,
    activeTenantId,
    tenants,
    loading,
    error,
    pendingTenantId,
    pendingPatchTenantId,
    creating,
    reload,
    switchTenant,
    setTenantActive,
    createTenant,
  } = useSuperAdminTenants();

  if (sessionStatus === "loading") {
    return null;
  }

  if (!isSuperAdmin) {
    return null;
  }

  if (loading && tenants.length === 0 && !error) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-full max-w-lg" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  const busyGlobal = pendingTenantId !== null || pendingPatchTenantId !== null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => {
                setWizardKey((k) => k + 1);
                setWizardOpen(true);
              }}
              disabled={loading}
            >
              <Plus className="size-4" />
              {t("newTenant")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              {t("refresh")}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <CreateTenantWizardDialog
          key={wizardKey}
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          createTenant={createTenant}
          creating={creating}
        />

        <div className="space-y-2 border-t pt-4">
          <p className="text-muted-foreground text-sm">{t("listDescription")}</p>

          {tenants.length === 0 ? (
            <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
              {t("empty")}
            </div>
          ) : (
            tenants.map((tenant) => {
              const isContext = tenant.id === activeTenantId;
              const pendingSwitch = tenant.id === pendingTenantId;
              const pendingToggle = tenant.id === pendingPatchTenantId;
              const rowBusy = busyGlobal;
              return (
                <div
                  key={tenant.id}
                  className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{tenant.name}</p>
                      {!tenant.isActive ? (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <span
                                className={cn(
                                  "rounded-md border border-dashed px-2 py-0.5 text-xs font-medium",
                                  "text-muted-foreground",
                                )}
                              >
                                {t("inactiveBadge")}
                              </span>
                            }
                          />
                          <TooltipContent side="top" className="max-w-sm">
                            <div className="space-y-1.5 text-left">
                              <p className="leading-tight font-semibold">{t("helpItemBadgeInactiveTitle")}</p>
                              <p className="text-xs leading-snug font-normal opacity-90">
                                {t("helpItemBadgeInactiveDesc")}
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                      {isContext && tenant.isActive ? (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                                  "border-success/40 bg-success/10 text-success",
                                  "",
                                )}
                              >
                                {t("active")}
                              </span>
                            }
                          />
                          <TooltipContent side="top" className="max-w-sm">
                            <div className="space-y-1.5 text-left">
                              <p className="leading-tight font-semibold">{t("helpItemBadgeActiveTitle")}</p>
                              <p className="text-xs leading-snug font-normal opacity-90">
                                {t("helpItemBadgeActiveDesc")}
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>
                    <p className="text-muted-foreground text-sm">{tenant.slug}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            size="icon"
                            variant={isContext ? "secondary" : "outline"}
                            className="size-9 shrink-0"
                            disabled={!tenant.isActive || rowBusy}
                            aria-label={
                              !tenant.isActive
                                ? t("switchDisabledHint")
                                : isContext
                                  ? t("currentContext")
                                  : t("switchToTenant")
                            }
                            onClick={() =>
                              void (async () => {
                                try {
                                  await switchTenant(tenant.id);
                                } catch {
                                  /* erro: toast global no apiClient */
                                }
                              })()
                            }
                          >
                            {pendingSwitch ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : isContext ? (
                              <Check className="size-4" />
                            ) : (
                              <ArrowRightLeft className="size-4" />
                            )}
                          </Button>
                        }
                      />
                      <TooltipContent side="top" className="max-w-sm">
                        {!tenant.isActive ? (
                          <div className="space-y-1.5 text-left">
                            <p className="leading-tight font-semibold">{t("switchDisabledHint")}</p>
                            <p className="text-xs leading-snug font-normal opacity-90">
                              {t("helpItemContextDesc")}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1.5 text-left">
                            <p className="leading-tight font-semibold">{t("helpItemContextTitle")}</p>
                            <p className="text-xs leading-snug font-normal opacity-90">
                              {t("helpItemContextDesc")}
                            </p>
                          </div>
                        )}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Switch
                            size="sm"
                            checked={tenant.isActive}
                            disabled={rowBusy}
                            onCheckedChange={(checked) => {
                              void (async () => {
                                try {
                                  await setTenantActive(tenant.id, checked);
                                  toast.success(checked ? t("enabledToast") : t("disabledToast"));
                                } catch {
                                  /* erro: toast global no apiClient */
                                }
                              })();
                            }}
                            aria-label={t("enabledAria")}
                          />
                        }
                      />
                      <TooltipContent side="top" className="max-w-sm">
                        <div className="space-y-1.5 text-left">
                          <p className="leading-tight font-semibold">{t("helpItemSwitchTitle")}</p>
                          <p className="text-xs leading-snug font-normal opacity-90">
                            {t("helpItemSwitchDesc")}
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                    {pendingToggle ? (
                      <Loader2 className="text-muted-foreground size-4 shrink-0 animate-spin" />
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
      <CardFooter className="mt-2 border-t pt-4">
        <p className="text-muted-foreground text-xs">{t("footer")}</p>
      </CardFooter>
    </Card>
  );
}
