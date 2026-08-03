"use client";

import { Copy, Info, Loader2, Mail, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import {
  EmailEventsInfoCallout,
  EmailEventsInfoDialog,
} from "@/features/settings/app/components/email-events-info-dialog";
import { useEmailDomainSettings } from "@/features/settings/app/hooks/use-email-domain-settings";
import { TenantSmtpSettingsBlock } from "@/features/settings/app/components/tenant-smtp-settings-block";
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
import { Input } from "@/shared/components/ui/input";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Switch } from "@/shared/components/ui/switch";
import { useSyncedDraft } from "@/shared/hooks/use-synced-draft";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";

function statusBadge(
  t: (key: string) => string,
  status: string,
) {
  const map: Record<string, { label: string; class: string }> = {
    none: { label: t("statusNone"), class: "bg-muted text-muted-foreground" },
    pending: { label: t("statusPending"), class: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
    not_started: { label: t("statusPending"), class: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
    verified: { label: t("statusVerified"), class: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
    failed: { label: t("statusFailed"), class: "bg-destructive/15 text-destructive" },
    temporary_failure: { label: t("statusFailed"), class: "bg-destructive/15 text-destructive" },
  };
  const m = map[status] ?? map.pending;
  if (!m) {
    return <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{status}</span>;
  }
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", m.class)}>{m.label}</span>;
}

export function EmailSettingsCard() {
  const t = useTranslations("settings.email");
  const tRoot = useTranslations("settings.whatsapp");
  const {
    sessionStatus,
    emailDomain: ed,
    hasLoaded,
    loading,
    error,
    busy,
    canEdit,
    reload,
    setup,
    verify,
    remove,
    patch,
  } = useEmailDomainSettings();

  const [domain, setDomain] = useState("");
  const [fromName, setFromName] = useState("");
  const [localPart, setLocalPart] = useState("notificacoes");
  const [eventsInfoOpen, setEventsInfoOpen] = useState(false);

  const serverSender = useMemo(
    () => ({ address: ed.fromAddress ?? "", name: ed.fromName ?? "" }),
    [ed.fromAddress, ed.fromName],
  );
  const [sender, setSender] = useSyncedDraft(serverSender);
  const draftFrom = sender.address;
  const draftName = sender.name;
  const setDraftFrom = (value: string) => setSender((prev) => ({ ...prev, address: value }));
  const setDraftName = (value: string) => setSender((prev) => ({ ...prev, name: value }));

  const onCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(tRoot("copied"));
    } catch {
      toast.error("Copy failed");
    }
  }, [tRoot]);

  const onSetup = useCallback(async () => {
    try {
      await setup({ domainName: domain.trim(), fromName: fromName.trim(), localPart: localPart.trim() });
      toast.success(t("saveSuccess"));
      setDomain("");
      setFromName("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("loadError"));
    }
  }, [domain, fromName, localPart, setup, t]);

  const onVerify = useCallback(async () => {
    try {
      await verify();
      toast.success(t("saveSuccess"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("loadError"));
    }
  }, [t, verify]);

  const onRemove = useCallback(async () => {
    if (typeof window !== "undefined" && !window.confirm(t("removeConfirm"))) return;
    try {
      await remove();
      toast.success(t("saveSuccess"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("loadError"));
    }
  }, [t, remove]);

  const onOutboundMode = useCallback(
    async (mode: "platform" | "smtp" | "resend_domain") => {
      if (mode === ed.outboundMode) return;
      if (!canEdit) return;
      try {
        await patch({ emailOutboundMode: mode });
        toast.success(t("saveSuccess"));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("loadError"));
      }
    },
    [canEdit, ed.outboundMode, patch, t],
  );

  const onSaveSender = useCallback(async () => {
    const name = draftName.trim();
    const addr = draftFrom.trim();
    const p: { fromName?: string; fromAddress?: string } = {};
    if (name !== (ed.fromName ?? "").trim()) p.fromName = name;
    if (addr !== (ed.fromAddress ?? "").trim()) p.fromAddress = addr;
    if (Object.keys(p).length === 0) return;
    try {
      await patch(p);
      toast.success(t("saveSuccess"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("loadError"));
    }
  }, [draftFrom, draftName, ed.fromAddress, ed.fromName, patch, t]);

  const hasDomainConfigured = ed.domainName && ed.status !== "none";
  const mode = ed.outboundMode;
  const showDnsRecords = (ed.dnsRecords?.length ?? 0) > 0;

  if (sessionStatus === "loading" || (loading && !hasLoaded && !error)) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-4 w-full max-w-lg" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error && !hasLoaded) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-5" />
            {t("title")}
          </CardTitle>
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
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-5" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <EmailEventsInfoCallout onOpen={() => setEventsInfoOpen(true)} />
        <EmailEventsInfoDialog open={eventsInfoOpen} onOpenChange={setEventsInfoOpen} />

        {mode !== "platform" && (
          <p className="text-muted-foreground text-sm">{t("fallbackGlobal")}</p>
        )}

        {canEdit ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("outboundModeLabel")}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === "platform" ? "default" : "outline"}
                onClick={() => void onOutboundMode("platform")}
                disabled={busy}
              >
                {t("outboundModePlatform")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "smtp" ? "default" : "outline"}
                onClick={() => void onOutboundMode("smtp")}
                disabled={busy}
              >
                {t("outboundModeSmtp")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "resend_domain" ? "default" : "outline"}
                onClick={() => void onOutboundMode("resend_domain")}
                disabled={busy}
              >
                {t("outboundModeDns")}
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">{t("outboundModeHint")}</p>
          </div>
        ) : mode !== "platform" ? (
          <p className="text-muted-foreground text-sm">
            {mode === "smtp" && t("outboundReadOnlySmtp")}
            {mode === "resend_domain" && t("outboundReadOnlyDns")}
          </p>
        ) : null}

        {mode === "platform" && (
          <Alert variant="info" className="text-sm">
            <Info className="size-4 shrink-0" aria-hidden />
            <AlertDescription className="min-w-0">
              <p className="text-foreground font-heading font-semibold leading-snug">{t("platformPanelTitle")}</p>
              <p className="text-sky-950/90 dark:text-sky-50/90 mt-2 text-sm leading-relaxed">
                {t("outboundModePlatformBody")}
              </p>
              {!canEdit && (
                <p className="text-muted-foreground border-sky-200/50 dark:border-sky-800/50 mt-3 border-t pt-3 text-xs leading-relaxed">
                  {t("outboundReadOnlyPlatform")}
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {canEdit && mode === "smtp" ? (
          <TenantSmtpSettingsBlock outboundMode={ed.outboundMode} />
        ) : null}
        {mode === "resend_domain" && hasDomainConfigured ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">{ed.domainName}</p>
              <div className="mt-1">{statusBadge(t as (key: string) => string, ed.status)}</div>
            </div>
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                {(ed.status === "pending" || ed.status === "not_started" || ed.status === "failed" || ed.status === "temporary_failure") && (
                  <Button type="button" size="sm" onClick={() => void onVerify()} disabled={busy}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                    {t("verify")}
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => void onRemove()} disabled={busy}>
                  <Trash2 className="size-4" />
                  {t("remove")}
                </Button>
              </div>
            )}
          </div>
        ) : null}

        {mode === "resend_domain" && ed.verifiedAt && ed.status === "verified" && (
          <p className="text-muted-foreground text-sm">
            {t("verifiedAt")}: {new Date(ed.verifiedAt).toLocaleString()}
          </p>
        )}

        {mode === "resend_domain" && showDnsRecords && ed.dnsRecords && (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {ed.status === "verified" ? t("dnsReferenceTitle") : t("dnsTitle")}
            </p>
            <p className="text-muted-foreground text-sm">
              {ed.status === "verified" ? t("dnsWhenVerified") : t("dnsHint")}
            </p>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-2 font-medium">Type</th>
                    <th className="p-2 font-medium">Name</th>
                    <th className="p-2 font-medium">Value</th>
                    <th className="p-2 w-24" />
                  </tr>
                </thead>
                <tbody>
                  {ed.dnsRecords.map((r, i) => {
                    const row = `${r.type}\t${r.name}\t${r.value}`;
                    return (
                      <tr key={i} className="border-t">
                        <td className="p-2 font-mono text-xs">{r.type}</td>
                        <td className="max-w-[8rem] truncate p-2 font-mono text-xs" title={r.name}>
                          {r.name}
                        </td>
                        <td className="max-w-[12rem] truncate p-2 font-mono text-xs" title={r.value}>
                          {r.value}
                        </td>
                        <td className="p-2">
                          <Button type="button" variant="ghost" size="sm" onClick={() => void onCopy(row)}>
                            <Copy className="size-4" />
                            {t("copy")}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {mode === "resend_domain" && ed.status === "verified" && canEdit && (
          <div className="space-y-4 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{t("enableCustom")}</p>
                <p className="text-muted-foreground text-xs">
                  {ed.fromAddress} — {ed.fromName}
                </p>
              </div>
              <Switch
                checked={ed.emailEnabled}
                onCheckedChange={(v) => {
                  void (async () => {
                    try {
                      await patch({ emailEnabled: v });
                      toast.success(t("saveSuccess"));
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : t("loadError"));
                    }
                  })();
                }}
                disabled={busy}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>{t("fromNameLabel")}</FieldLabel>
                <FieldContent>
                  <Input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder={t("fromNamePlaceholder")}
                  />
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel>{t("fromAddressLabel")}</FieldLabel>
                <FieldContent>
                  <Input
                    type="email"
                    value={draftFrom}
                    onChange={(e) => setDraftFrom(e.target.value)}
                  />
                </FieldContent>
                <FieldDescription>{t("localPartHint")}</FieldDescription>
              </Field>
            </div>
            <Button type="button" size="sm" onClick={() => void onSaveSender()} disabled={busy}>
              {t("saveSender")}
            </Button>
          </div>
        )}

        {mode === "resend_domain" && !hasDomainConfigured && canEdit && (
          <div className="space-y-4">
            <Field>
              <FieldLabel>{t("domainLabel")}</FieldLabel>
              <FieldContent>
                <Input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder={t("domainPlaceholder")}
                  autoComplete="off"
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>{t("fromNameLabel")}</FieldLabel>
              <FieldContent>
                <Input
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder={t("fromNamePlaceholder")}
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>{t("localPartLabel")}</FieldLabel>
              <FieldContent>
                <Input
                  value={localPart}
                  onChange={(e) => setLocalPart(e.target.value)}
                  placeholder={t("localPartPlaceholder")}
                />
              </FieldContent>
              <FieldDescription>{t("localPartHint")}</FieldDescription>
            </Field>
          </div>
        )}
      </CardContent>
      {mode === "resend_domain" && !hasDomainConfigured && canEdit && (
        <CardFooter>
          <Button type="button" onClick={() => void onSetup()} disabled={busy || !domain.trim() || !fromName.trim() || !localPart.trim()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("submitSetup")}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
