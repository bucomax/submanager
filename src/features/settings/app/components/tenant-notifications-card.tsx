"use client";

import { Loader2, RefreshCw, Save } from "lucide-react";
import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { useTenantNotifications } from "@/features/settings/app/hooks/use-tenant-notifications";
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
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/shared/components/ui/field";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Switch } from "@/shared/components/ui/switch";
import { useSyncedDraft } from "@/shared/hooks/use-synced-draft";
import type { TenantNotificationSettingsDto } from "@/types/api/tenant-settings-v1";

const preferenceKeys: Array<keyof TenantNotificationSettingsDto> = [
  "notifyCriticalAlerts",
  "notifySurgeryReminders",
  "notifyNewPatients",
  "notifyWeeklyReport",
  "notifyDocumentDelivery",
];

export function TenantNotificationsCard() {
  const t = useTranslations("settings.notifications");
  const {
    sessionStatus,
    preferences,
    hasLoaded,
    loading,
    error,
    saving,
    canEdit,
    reload,
    savePreferences,
  } = useTenantNotifications();

  const [draft, setDraft] = useSyncedDraft(preferences);

  const isDirty = useMemo(
    () => preferenceKeys.some((key) => draft[key] !== preferences[key]),
    [draft, preferences],
  );

  async function onSave() {
    try {
      await savePreferences(draft);
      toast.success(t("saved"));
    } catch {
      await reload();
    }
  }

  if (sessionStatus === "loading" || (loading && !hasLoaded && !error)) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-4 w-full max-w-lg" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error && !hasLoaded) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-destructive text-sm">{error}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
            <RefreshCw className="size-4" />
            {t("retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {t("refresh")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canEdit ? <p className="text-muted-foreground text-sm">{t("editForbidden")}</p> : null}
        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <Field orientation="horizontal" className="items-start justify-between gap-4 rounded-lg border p-4">
          <FieldContent className="min-w-0 flex-1 pr-2">
            <FieldLabel htmlFor="notify-critical-alerts">{t("criticalAlertsTitle")}</FieldLabel>
            <FieldDescription>{t("criticalAlertsDescription")}</FieldDescription>
          </FieldContent>
          <Switch
            id="notify-critical-alerts"
            size="sm"
            className="mt-0.5 shrink-0"
            checked={draft.notifyCriticalAlerts}
            disabled={!canEdit || saving}
            onCheckedChange={(next) =>
              setDraft((current) => ({
                ...current,
                notifyCriticalAlerts: next,
              }))
            }
          />
        </Field>

        <Field orientation="horizontal" className="items-start justify-between gap-4 rounded-lg border p-4">
          <FieldContent className="min-w-0 flex-1 pr-2">
            <FieldLabel htmlFor="notify-surgery-reminders">{t("surgeryRemindersTitle")}</FieldLabel>
            <FieldDescription>{t("surgeryRemindersDescription")}</FieldDescription>
          </FieldContent>
          <Switch
            id="notify-surgery-reminders"
            size="sm"
            className="mt-0.5 shrink-0"
            checked={draft.notifySurgeryReminders}
            disabled={!canEdit || saving}
            onCheckedChange={(next) =>
              setDraft((current) => ({
                ...current,
                notifySurgeryReminders: next,
              }))
            }
          />
        </Field>

        <Field orientation="horizontal" className="items-start justify-between gap-4 rounded-lg border p-4">
          <FieldContent className="min-w-0 flex-1 pr-2">
            <FieldLabel htmlFor="notify-new-patients">{t("newPatientsTitle")}</FieldLabel>
            <FieldDescription>{t("newPatientsDescription")}</FieldDescription>
          </FieldContent>
          <Switch
            id="notify-new-patients"
            size="sm"
            className="mt-0.5 shrink-0"
            checked={draft.notifyNewPatients}
            disabled={!canEdit || saving}
            onCheckedChange={(next) =>
              setDraft((current) => ({
                ...current,
                notifyNewPatients: next,
              }))
            }
          />
        </Field>

        <Field orientation="horizontal" className="items-start justify-between gap-4 rounded-lg border p-4">
          <FieldContent className="min-w-0 flex-1 pr-2">
            <FieldLabel htmlFor="notify-weekly-report">{t("weeklyReportTitle")}</FieldLabel>
            <FieldDescription>{t("weeklyReportDescription")}</FieldDescription>
          </FieldContent>
          <Switch
            id="notify-weekly-report"
            size="sm"
            className="mt-0.5 shrink-0"
            checked={draft.notifyWeeklyReport}
            disabled={!canEdit || saving}
            onCheckedChange={(next) =>
              setDraft((current) => ({
                ...current,
                notifyWeeklyReport: next,
              }))
            }
          />
        </Field>

        <Field orientation="horizontal" className="items-start justify-between gap-4 rounded-lg border p-4">
          <FieldContent className="min-w-0 flex-1 pr-2">
            <FieldLabel htmlFor="notify-document-delivery">{t("documentDeliveryTitle")}</FieldLabel>
            <FieldDescription>{t("documentDeliveryDescription")}</FieldDescription>
          </FieldContent>
          <Switch
            id="notify-document-delivery"
            size="sm"
            className="mt-0.5 shrink-0"
            checked={draft.notifyDocumentDelivery}
            disabled={!canEdit || saving}
            onCheckedChange={(next) =>
              setDraft((current) => ({
                ...current,
                notifyDocumentDelivery: next,
              }))
            }
          />
        </Field>
      </CardContent>
      <CardFooter className="justify-end border-t pt-4">
        <Button type="button" onClick={() => void onSave()} disabled={!canEdit || saving || !isDirty}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {saving ? t("saving") : t("save")}
        </Button>
      </CardFooter>
    </Card>
  );
}
