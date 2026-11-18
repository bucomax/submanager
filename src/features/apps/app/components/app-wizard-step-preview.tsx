"use client";

import { Blocks } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/shared/components/ui/badge";
import type { WizardValues } from "@/features/apps/app/utils/app-wizard-schema";

export function AppWizardStepPreview({
  values,
  iconPreview,
  screenshotCount,
}: {
  values: WizardValues;
  iconPreview: string | null;
  screenshotCount: number;
}) {
  const tw = useTranslations("apps.admin.wizard");
  const tCat = useTranslations("apps.catalog.categories");

  const pricingLabel = {
    free: tw("pricingFree"),
    flat: tw("pricingFlat"),
    per_seat: tw("pricingPerSeat"),
    usage_based: tw("pricingUsageBased"),
  }[values.pricingModel];

  const renderLabel = {
    iframe: tw("renderModeIframe"),
    internal: tw("renderModeInternal"),
    external_link: tw("renderModeExternal"),
  }[values.renderMode];

  return (
    <div className="space-y-4">
      {/* Card preview */}
      <div
        className="flex items-center gap-4 rounded-xl border p-4"
        style={
          values.accentColor
            ? { borderTopColor: values.accentColor, borderTopWidth: 3 }
            : undefined
        }
      >
        {iconPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconPreview} alt="" className="size-14 shrink-0 rounded-2xl object-cover" />
        ) : (
          <div
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-muted"
            style={values.accentColor ? { backgroundColor: `${values.accentColor}15` } : undefined}
          >
            <Blocks
              className="size-7"
              style={values.accentColor ? { color: values.accentColor } : undefined}
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{values.name || "—"}</h3>
          {values.tagline && (
            <p className="text-sm text-muted-foreground">{values.tagline}</p>
          )}
          {values.developerName && (
            <p className="text-xs text-muted-foreground">{values.developerName}</p>
          )}
        </div>
        <Badge variant="outline" className="text-xs">
          {tCat(values.category)}
        </Badge>
      </div>

      {/* Details grid */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {values.slug && (
          <div>
            <dt className="text-muted-foreground">{tw("slug")}</dt>
            <dd className="font-medium font-mono text-xs">{values.slug}</dd>
          </div>
        )}
        <div>
          <dt className="text-muted-foreground">{tw("renderMode")}</dt>
          <dd className="font-medium">{renderLabel}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{tw("pricingModel")}</dt>
          <dd className="font-medium">{pricingLabel}</dd>
        </div>
        {values.pricingModel !== "free" && (
          <div>
            <dt className="text-muted-foreground">{tw("priceInCents")}</dt>
            <dd className="font-medium">
              {((values.priceInCents ?? 0) / 100).toFixed(2)} / {values.billingInterval}
            </dd>
          </div>
        )}
        {values.trialDays > 0 && (
          <div>
            <dt className="text-muted-foreground">{tw("trialDays")}</dt>
            <dd className="font-medium">{values.trialDays}</dd>
          </div>
        )}
        <div>
          <dt className="text-muted-foreground">{tw("isFeatured")}</dt>
          <dd className="font-medium">{values.isFeatured ? "Sim" : "Não"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{tw("requiresConfig")}</dt>
          <dd className="font-medium">{values.requiresConfig ? "Sim" : "Não"}</dd>
        </div>
        {screenshotCount > 0 && (
          <div>
            <dt className="text-muted-foreground">{tw("screenshots")}</dt>
            <dd className="font-medium">{screenshotCount}</dd>
          </div>
        )}
      </dl>

      {values.description && (
        <div>
          <p className="mb-1 text-sm text-muted-foreground">{tw("description")}</p>
          <div className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap">
            {values.description}
          </div>
        </div>
      )}
    </div>
  );
}
