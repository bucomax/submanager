"use client";

import { AlertTriangle, Loader2, Send } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";

import { useTenantSmtp } from "@/features/settings/app/hooks/use-tenant-smtp";
import { toast } from "@/lib/toast";
import { Button } from "@/shared/components/ui/button";
import { Field, FieldContent, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { InfoTooltip } from "@/shared/components/ui/info-tooltip";
import { useSyncedDraft } from "@/shared/hooks/use-synced-draft";

type Props = { disabled?: boolean; outboundMode?: "platform" | "smtp" | "resend_domain" };

export function TenantSmtpSettingsBlock({ disabled: disabledProp = false, outboundMode = "platform" }: Props) {
  const t = useTranslations("settings.email.smtp");
  const { smtp, hasLoaded, loading, error, busy, canEdit, save, test, reload } = useTenantSmtp();

  useEffect(() => {
    if (outboundMode === "smtp") {
      void reload();
    }
  }, [outboundMode, reload]);

  /** A senha nunca volta da API: o campo sempre reabre vazio. */
  const serverForm = useMemo(
    () => ({
      host: smtp.smtpHost ?? "",
      port: String(smtp.smtpPort ?? 587),
      ssl: smtp.smtpSecure,
      user: smtp.smtpUser ?? "",
      password: "",
      fromName: smtp.smtpFromName ?? "",
      fromAddress: smtp.smtpFromAddress ?? "",
    }),
    [smtp],
  );
  const [form, setForm] = useSyncedDraft(serverForm);
  const { host, port, ssl, user, password, fromName, fromAddress } = form;

  const setHost = (value: string) => setForm((prev) => ({ ...prev, host: value }));
  const setPort = (value: string) => setForm((prev) => ({ ...prev, port: value }));
  const setSsl = (value: boolean) => setForm((prev) => ({ ...prev, ssl: value }));
  const setUser = (value: string) => setForm((prev) => ({ ...prev, user: value }));
  const setPassword = (value: string) => setForm((prev) => ({ ...prev, password: value }));
  const setFromName = (value: string) => setForm((prev) => ({ ...prev, fromName: value }));
  const setFromAddress = (value: string) => setForm((prev) => ({ ...prev, fromAddress: value }));

  const onSave = useCallback(async () => {
    if (!canEdit) return;
    const portNum = parseInt(port, 10);
    if (Number.isNaN(portNum) || portNum < 1 || portNum > 65535) {
      toast.error(t("invalidPort"));
      return;
    }
    try {
      await save({
        smtpEnabled: smtp.smtpEnabled,
        smtpHost: host.trim() || undefined,
        smtpPort: portNum,
        smtpSecure: ssl,
        smtpUser: user.trim() || undefined,
        smtpFromName: fromName.trim() || undefined,
        smtpFromAddress: fromAddress.trim() || undefined,
        smtpPassword: password.trim() || undefined,
      });
      setForm((prev) => ({ ...prev, password: "" }));
      toast.success(t("saveOk"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("saveFail"));
    }
  }, [
    canEdit,
    fromAddress,
    fromName,
    host,
    port,
    password,
    save,
    setForm,
    smtp.smtpEnabled,
    ssl,
    t,
    user,
  ]);

  const onToggle = useCallback(
    async (v: boolean) => {
      if (!canEdit) return;
      if (v) {
        const portNum = parseInt(port, 10);
        const needPass = !smtp.hasPassword;
        if (
          Number.isNaN(portNum) ||
          !host.trim() ||
          !user.trim() ||
          !fromName.trim() ||
          !fromAddress.trim() ||
          (needPass && !password.trim())
        ) {
          toast.error(t("incompleteToEnable"));
          return;
        }
        try {
          await save({
            smtpEnabled: true,
            smtpHost: host.trim() || undefined,
            smtpPort: portNum,
            smtpSecure: ssl,
            smtpUser: user.trim() || undefined,
            smtpFromName: fromName.trim() || undefined,
            smtpFromAddress: fromAddress.trim() || undefined,
            smtpPassword: password.trim() || undefined,
          });
          setForm((prev) => ({ ...prev, password: "" }));
          toast.success(t("saveOk"));
        } catch (e) {
          toast.error(e instanceof Error ? e.message : t("saveFail"));
        }
      } else {
        try {
          await save({ smtpEnabled: false });
          toast.success(t("saveOk"));
        } catch (e) {
          toast.error(e instanceof Error ? e.message : t("saveFail"));
        }
      }
    },
    [
      canEdit,
      fromAddress,
      fromName,
      host,
      password,
      port,
      save,
      setForm,
      smtp.hasPassword,
      ssl,
      t,
      user,
    ],
  );

  const onTest = useCallback(async () => {
    if (!canEdit) return;
    try {
      await test();
      toast.success(t("testOk"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("testFail"));
    }
  }, [canEdit, test, t]);

  const disabled = disabledProp || !canEdit;
  if (loading && !hasLoaded) {
    return <Skeleton className="h-40 w-full" />;
  }
  if (error && !hasLoaded) {
    return (
      <div className="space-y-2">
        <p className="text-destructive text-sm">{error}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-start gap-1.5">
        <h3 className="text-sm font-medium leading-snug">{t("title")}</h3>
        <InfoTooltip
          ariaLabel={t("hintInfoAria")}
          triggerClassName="mt-0 p-1"
          popupClassName="max-w-md text-pretty"
        >
          {t("hint")}
        </InfoTooltip>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium">{t("enabled")}</p>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm">{smtp.smtpEnabled ? t("on") : t("off")}</span>
          <Switch
            checked={smtp.smtpEnabled}
            onCheckedChange={(v) => void onToggle(v)}
            disabled={disabled || busy}
          />
        </div>
      </div>
      {smtp.hasPassword && smtp.smtpEnabled ? (
        <p className="text-muted-foreground text-xs">{t("hasPassword")}</p>
      ) : null}
      {smtp.smtpEnabled && !smtp.hasPassword && canEdit ? (
        <Alert variant="warning" className="text-sm">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          <AlertDescription className="text-sm leading-relaxed">
            {t("passwordRequired")}
          </AlertDescription>
        </Alert>
      ) : null}
      {canEdit ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>{t("host")}</FieldLabel>
              <FieldContent>
                <Input
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="smtp.gmail.com"
                  disabled={disabled}
                  autoComplete="off"
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>{t("port")}</FieldLabel>
              <FieldContent>
                <Input value={port} onChange={(e) => setPort(e.target.value)} disabled={disabled} />
              </FieldContent>
            </Field>
          </div>
          <div className="bg-muted/40 border-border flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium leading-snug">{t("ssl")}</p>
              <p className="text-muted-foreground text-xs leading-relaxed">{t("sslHint")}</p>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-2 sm:pl-2">
              <span className="text-muted-foreground text-sm tabular-nums">{ssl ? t("on") : t("off")}</span>
              <Switch checked={ssl} onCheckedChange={setSsl} disabled={disabled || busy} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>{t("user")}</FieldLabel>
              <FieldContent>
                <Input
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  autoComplete="off"
                  disabled={disabled}
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>{t("password")}</FieldLabel>
              <FieldContent>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("passwordPlaceholder")}
                  autoComplete="new-password"
                  disabled={disabled}
                />
              </FieldContent>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>{t("fromName")}</FieldLabel>
              <FieldContent>
                <Input value={fromName} onChange={(e) => setFromName(e.target.value)} disabled={disabled} />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>{t("fromAddress")}</FieldLabel>
              <FieldContent>
                <Input
                  type="email"
                  value={fromAddress}
                  onChange={(e) => setFromAddress(e.target.value)}
                  disabled={disabled}
                />
              </FieldContent>
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void onSave()} disabled={disabled || busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("save")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void onTest()}
              disabled={disabled || busy || !smtp.smtpEnabled}
            >
              <Send className="size-4" />
              {t("test")}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
