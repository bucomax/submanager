"use client";

import { useAppDetail } from "@/features/apps/app/hooks/use-app-detail";
import { useAppActivation } from "@/features/apps/app/hooks/use-app-activation";
import { AppConfigForm } from "./app-config-form";
import { AppDeactivateDialog } from "./app-deactivate-dialog";
import { AppIcon } from "./app-icon";
import { AppStatusBadge } from "./app-status-badge";
import { AppViewer } from "./app-viewer";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/shared/components/ui/dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  appId: string;
};

export function AppDetailView({ appId }: Props) {
  const t = useTranslations("apps.detail");
  const tCat = useTranslations("apps.catalog.categories");
  const { data, loading, refresh } = useAppDetail(appId);
  const { activate, deactivate, activating, deactivating } = useAppActivation(
    useCallback(() => void refresh(), [refresh]),
  );
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (!data) return null;

  const isActive = data.tenantApp?.status === "active";
  const isPending = data.tenantApp?.status === "pending_config";
  const hasNoTenantApp = !data.tenantApp;

  // Active app — show the viewer with a minimal header
  if (isActive) {
    return (
      <div className="space-y-4">
        {/* Compact header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/apps"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <AppIcon iconUrl={data.iconUrl} accentColor={data.accentColor} size="sm" />
            <h1 className="text-lg font-semibold">{data.name}</h1>
            <AppStatusBadge status={data.tenantApp?.status ?? null} />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDeactivateOpen(true)}
            disabled={deactivating}
          >
            {deactivating ? "…" : t("deactivate")}
          </Button>
        </div>

        {/* App content */}
        <AppViewer app={data} />

        <AppDeactivateDialog
          open={deactivateOpen}
          onOpenChange={setDeactivateOpen}
          appName={data.name}
          onConfirm={() => deactivate(data.id)}
        />
      </div>
    );
  }

  // Catalog detail view (not active)
  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/apps"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("back")}
      </Link>

      {/* Header */}
      <div
        className="flex flex-col gap-4 rounded-xl border p-6 sm:flex-row sm:items-center"
        style={data.accentColor ? { borderTopColor: data.accentColor, borderTopWidth: 3 } : undefined}
      >
        <AppIcon iconUrl={data.iconUrl} accentColor={data.accentColor} size="lg" className="size-20 rounded-2xl" />

        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-2xl font-semibold">{data.name}</h1>
          {data.tagline && <p className="text-muted-foreground">{data.tagline}</p>}
          {data.developerName && (
            <p className="text-sm text-muted-foreground">
              {data.developerName}
              {data.developerUrl && (
                <a
                  href={data.developerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1.5 inline-flex items-center gap-0.5 text-primary hover:underline"
                >
                  <ExternalLink className="size-3" />
                </a>
              )}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <AppStatusBadge status={data.tenantApp?.status ?? null} />
          {(hasNoTenantApp || isPending) && !data.requiresConfig && (
            <Button
              size="sm"
              onClick={() => activate(data.id)}
              disabled={activating}
            >
              {activating ? "…" : t("activate")}
            </Button>
          )}
        </div>
      </div>

      {/* Config form for apps that require config */}
      {(hasNoTenantApp || isPending) && data.requiresConfig && data.configSchema && data.configSchema.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("configTitle")}</CardTitle>
            <CardDescription>{t("configDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <AppConfigForm
              fields={data.configSchema}
              onSubmit={async (config) => {
                await activate(data.id, config);
              }}
              submitting={activating}
            />
          </CardContent>
        </Card>
      )}

      {/* Screenshots */}
      {data.screenshots.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">{t("screenshots")}</h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {data.screenshots.map((ss, idx) => (
              <button
                key={ss.id}
                type="button"
                className="shrink-0 overflow-hidden rounded-lg border bg-muted transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setLightboxIndex(idx)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada do storage */}
                <img
                  src={ss.imageUrl}
                  alt={ss.caption?.["pt-BR"] ?? ss.caption?.["en"] ?? ""}
                  className="h-48 w-auto object-cover"
                />
                {ss.caption && (
                  <p className="px-2 py-1 text-xs text-muted-foreground">
                    {ss.caption["pt-BR"] ?? ss.caption["en"]}
                  </p>
                )}
              </button>
            ))}
          </div>

          {/* Lightbox */}
          <Dialog
            open={lightboxIndex !== null}
            onOpenChange={(open) => { if (!open) setLightboxIndex(null); }}
          >
            <DialogContent className="max-w-4xl border-none bg-black/90 p-0 shadow-none [&>button]:text-white">
              {lightboxIndex !== null && data.screenshots[lightboxIndex] && (() => {
                const ss = data.screenshots[lightboxIndex];
                const caption = ss.caption?.["pt-BR"] ?? ss.caption?.["en"];
                return (
                  <div className="relative flex flex-col items-center">
                    {/* Navigation */}
                    {data.screenshots.length > 1 && (
                      <>
                        <button
                          type="button"
                          className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70 disabled:opacity-30"
                          disabled={lightboxIndex === 0}
                          onClick={() => setLightboxIndex((i) => Math.max(0, (i ?? 0) - 1))}
                        >
                          <ChevronLeft className="size-6" />
                        </button>
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70 disabled:opacity-30"
                          disabled={lightboxIndex === data.screenshots.length - 1}
                          onClick={() => setLightboxIndex((i) => Math.min(data.screenshots.length - 1, (i ?? 0) + 1))}
                        >
                          <ChevronRight className="size-6" />
                        </button>
                      </>
                    )}

                    {/* Image */}
                    {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada do storage */}
                    <img
                      src={ss.imageUrl}
                      alt={caption ?? ""}
                      className="max-h-[80vh] w-auto object-contain"
                    />

                    {/* Caption + counter */}
                    <div className="flex w-full items-center justify-between px-4 py-3">
                      <p className="text-sm text-white/80">{caption ?? ""}</p>
                      <span className="text-xs text-white/50">
                        {lightboxIndex + 1} / {data.screenshots.length}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </DialogContent>
          </Dialog>
        </section>
      )}

      {/* Sobre */}
      {data.description && (
        <Card>
          <CardHeader>
            <CardTitle>{t("about")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
              {data.description}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info */}
      <Card>
        <CardHeader>
          <CardTitle>{t("info")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">{t("category")}</dt>
              <dd className="font-medium">{tCat(data.category)}</dd>
            </div>
            {data.developerName && (
              <div>
                <dt className="text-muted-foreground">{t("developer")}</dt>
                <dd className="font-medium">{data.developerName}</dd>
              </div>
            )}
            {data.developerUrl && (
              <div>
                <dt className="text-muted-foreground">{t("website")}</dt>
                <dd>
                  <a
                    href={data.developerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    {data.developerUrl}
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
