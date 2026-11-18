"use client";

import { Card, CardContent } from "@/shared/components/ui/card";
import { AppIcon } from "./app-icon";
import { AppStatusBadge } from "./app-status-badge";
import type { AppCatalogCardDto } from "@/types/api/apps-v1";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

type Props = {
  app: AppCatalogCardDto;
};

function formatPrice(priceInCents: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(priceInCents / 100);
}

export function AppCatalogCard({ app }: Props) {
  const t = useTranslations("apps.card");

  return (
    <Link href={`/dashboard/apps/${app.slug}`} className="block">
      <Card className="group relative h-full transition-shadow hover:shadow-md">
        {app.accentColor && (
          <div
            className="absolute inset-x-0 top-0 h-1 rounded-t-xl"
            style={{ backgroundColor: app.accentColor }}
          />
        )}
        <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
          <AppIcon iconUrl={app.iconUrl} accentColor={app.accentColor} size="lg" />

          <div className="space-y-1">
            <h3 className="text-sm font-semibold leading-tight">{app.name}</h3>
            {app.tagline && (
              <p className="text-xs text-muted-foreground line-clamp-2">{app.tagline}</p>
            )}
          </div>

          {app.developerName && (
            <p className="text-xs text-muted-foreground">
              {t("byDeveloper", { name: app.developerName })}
            </p>
          )}

          <div className="flex flex-col items-center gap-1.5">
            {app.pricingModel === "free" ? (
              <span className="text-xs font-medium text-success">{t("free")}</span>
            ) : app.priceInCents != null ? (
              <div className="text-center">
                <span className="text-sm font-semibold">
                  {formatPrice(app.priceInCents, app.priceCurrency, "pt-BR")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {app.pricingModel === "per_seat"
                    ? t("perSeat")
                    : app.billingInterval === "monthly"
                      ? t("perMonth")
                      : t("perYear")}
                </span>
                {app.trialDays > 0 && (
                  <p className="text-xs text-info">{t("trialDays", { days: app.trialDays })}</p>
                )}
              </div>
            ) : null}

            <AppStatusBadge status={app.tenantStatus} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
