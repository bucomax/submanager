"use client";

import { AppIcon } from "@/features/apps/app/components/app-icon";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Dialog, StandardDialogContent } from "@/shared/components/ui/dialog";
import type { AppDto } from "@/types/api/apps-v1";
import { ExternalLink, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

type Props = {
  app: AppDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatPrice(priceInCents: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(priceInCents / 100);
}

function captionForLocale(
  caption: Record<string, string> | null | undefined,
  locale: string,
): string {
  if (!caption) return "";
  if (locale.startsWith("pt")) return caption["pt-BR"] ?? caption["en"] ?? "";
  return caption["en"] ?? caption["pt-BR"] ?? "";
}

export function AdminAppStorePreviewDialog({ app, open, onOpenChange }: Props) {
  const t = useTranslations("apps.admin.preview");
  const tCat = useTranslations("apps.catalog.categories");
  const tCard = useTranslations("apps.card");
  const tWizard = useTranslations("apps.admin.wizard");
  const locale = useLocale();

  const intlLocale = locale === "en" ? "en" : "pt-BR";

  if (!app) return null;

  const renderModeLabel =
    app.renderMode === "iframe"
      ? tWizard("renderModeIframe")
      : app.renderMode === "internal"
        ? tWizard("renderModeInternal")
        : tWizard("renderModeExternal");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <StandardDialogContent
          size="xl"
          title={t("dialogTitle")}
          description={t("dialogDescription")}
          bodyClassName="p-0 sm:px-0"
          footer={
            <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
              {t("close")}
            </Button>
          }
        >
          <div className="px-1 pb-1">
            <div
              className="overflow-hidden rounded-3xl border bg-card shadow-sm"
              style={
                app.accentColor
                  ? { borderTopColor: app.accentColor, borderTopWidth: 4 }
                  : undefined
              }
            >
              <div
                className="flex flex-col items-center bg-gradient-to-b from-muted/40 to-background px-5 pt-8 pb-6"
                style={
                  app.accentColor
                    ? {
                        background: `linear-gradient(180deg, color-mix(in srgb, ${app.accentColor} 14%, transparent) 0%, hsl(var(--background)) 100%)`,
                      }
                    : undefined
                }
              >
                <div
                  className="mb-4 shadow-md ring-2 ring-border/50"
                  style={{ borderRadius: "1.4rem" }}
                >
                  <AppIcon
                    iconUrl={app.iconUrl}
                    accentColor={app.accentColor}
                    size="lg"
                    className="!size-24 !rounded-3xl"
                  />
                </div>
                <h2 className="text-center text-2xl font-bold tracking-tight">{app.name}</h2>
                {app.tagline && (
                  <p className="text-muted-foreground mt-1.5 text-center text-sm leading-snug">
                    {app.tagline}
                  </p>
                )}
                {app.developerName && (
                  <p className="text-muted-foreground mt-1 text-xs">
                    {tCard("byDeveloper", { name: app.developerName })}
                  </p>
                )}
                {app.developerUrl && (
                  <a
                    href={app.developerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary mt-0.5 inline-flex items-center gap-1 text-xs font-medium hover:underline"
                  >
                    {t("developerSite")}
                    <ExternalLink className="size-3" />
                  </a>
                )}

                <div className="mt-4 flex max-w-md flex-wrap items-center justify-center gap-2">
                  <Badge variant={app.isPublished ? "default" : "secondary"}>
                    {app.isPublished ? t("statusPublished") : t("statusDraft")}
                  </Badge>
                  <Badge variant="outline">{tCat(app.category)}</Badge>
                  {app.isFeatured && (
                    <Badge variant="secondary" className="gap-0.5">
                      <Star className="size-3 fill-warning text-warning" />
                      {t("featured")}
                    </Badge>
                  )}
                </div>

                <div className="mt-4 text-center">
                  {app.pricingModel === "free" ? (
                    <p className="text-sm font-semibold text-success">
                      {tCard("free")}
                    </p>
                  ) : app.priceInCents != null ? (
                    <div className="space-y-0.5">
                      <p className="text-lg font-bold">
                        {formatPrice(app.priceInCents, app.priceCurrency, intlLocale)}
                        <span className="text-muted-foreground text-sm font-normal">
                          {app.pricingModel === "per_seat"
                            ? tCard("perSeat")
                            : app.billingInterval === "monthly"
                              ? tCard("perMonth")
                              : tCard("perYear")}
                        </span>
                      </p>
                      {app.trialDays > 0 && (
                        <p className="text-xs text-info">
                          {tCard("trialDays", { days: app.trialDays })}
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="border-border border-t bg-muted/30 px-4 py-4">
                <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                  {t("screenshots")}
                </p>
                {app.screenshots.length > 0 ? (
                  <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {app.screenshots
                      .slice()
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((ss) => (
                        <div
                          key={ss.id}
                          className="w-[min(100%,15rem)] shrink-0 snap-start"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={ss.imageUrl}
                            alt=""
                            className="bg-background aspect-[9/19] w-full max-w-[11rem] rounded-2xl border object-cover object-top shadow-sm"
                          />
                          {(() => {
                            const c = captionForLocale(ss.caption, locale);
                            return c ? (
                              <p className="text-muted-foreground mt-1 line-clamp-2 text-center text-xs">
                                {c}
                              </p>
                            ) : null;
                          })()}
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground rounded-xl border border-dashed bg-muted/50 px-3 py-6 text-center text-sm">
                    {t("noScreenshots")}
                  </p>
                )}
              </div>

              <div className="border-border space-y-3 border-t px-4 py-5">
                <h3 className="text-sm font-semibold">{t("about")}</h3>
                {app.description?.trim() ? (
                  <div className="prose prose-sm dark:prose-invert text-muted-foreground max-w-none whitespace-pre-wrap">
                    {app.description}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">{t("noDescription")}</p>
                )}

                <dl className="text-muted-foreground grid gap-2 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-foreground font-medium">{t("type")}</dt>
                    <dd>{renderModeLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-foreground font-medium">{t("slug")}</dt>
                    <dd className="font-mono">{app.slug}</dd>
                  </div>
                  {app.internalRoute && (
                    <div className="sm:col-span-2">
                      <dt className="text-foreground font-medium">{t("internalRoute")}</dt>
                      <dd className="font-mono break-all">{app.internalRoute}</dd>
                    </div>
                  )}
                  {app.iframeBaseUrl && (
                    <div className="sm:col-span-2">
                      <dt className="text-foreground font-medium">{t("iframeUrl")}</dt>
                      <dd className="font-mono break-all">{app.iframeBaseUrl}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </div>
        </StandardDialogContent>
      ) : null}
    </Dialog>
  );
}
