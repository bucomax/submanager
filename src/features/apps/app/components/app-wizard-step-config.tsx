"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { FormInput, FormSearchableSelect, FormSelect } from "@/shared/components/forms";
import { Field, FieldLabel } from "@/shared/components/ui/field";
import { Switch } from "@/shared/components/ui/switch";
import type { WizardValues } from "@/features/apps/app/utils/app-wizard-schema";

/** Passo 2 do wizard: modo de renderização, flags e preço. */
export function AppWizardStepConfig() {
  const tw = useTranslations("apps.admin.wizard");
  const { control, setValue } = useFormContext<WizardValues>();
  const renderMode = useWatch({ control, name: "renderMode" });
  const pricingModel = useWatch({ control, name: "pricingModel" });
  const requiresConfig = useWatch({ control, name: "requiresConfig" });
  const isFeatured = useWatch({ control, name: "isFeatured" });

  const renderModeOptions = useMemo(
    () => [
      { value: "iframe", label: tw("renderModeIframe") },
      { value: "internal", label: tw("renderModeInternal") },
      { value: "external_link", label: tw("renderModeExternal") },
    ],
    [tw],
  );

  const pricingModelOptions = useMemo(
    () => [
      { value: "free", label: tw("pricingFree") },
      { value: "flat", label: tw("pricingFlat") },
      { value: "per_seat", label: tw("pricingPerSeat") },
      { value: "usage_based", label: tw("pricingUsageBased") },
    ],
    [tw],
  );

  const billingIntervalOptions = useMemo(
    () => [
      { value: "monthly", label: tw("billingMonthly") },
      { value: "yearly", label: tw("billingYearly") },
    ],
    [tw],
  );

  return (
    <>
    <FormSearchableSelect
      name="renderMode"
      label={tw("renderMode")}
      options={renderModeOptions}
    />

    {renderMode === "iframe" && (
      <FormInput
        name="iframeBaseUrl"
        label={tw("iframeBaseUrl")}
        description={tw("iframeBaseUrlHint")}
        placeholder="https://app.example.com/embed"
        autoFocus
      />
    )}
    {renderMode === "internal" && (
      <FormInput
        name="internalRoute"
        label={tw("internalRoute")}
        placeholder="/dashboard/apps/my-app"
        autoFocus
      />
    )}

    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field>
        <div className="flex items-center justify-between">
          <FieldLabel>{tw("requiresConfig")}</FieldLabel>
          <Switch
            checked={requiresConfig}
            onCheckedChange={(v) => setValue("requiresConfig", v)}
          />
        </div>
      </Field>
      <Field>
        <div className="flex items-center justify-between">
          <FieldLabel>{tw("isFeatured")}</FieldLabel>
          <Switch
            checked={isFeatured}
            onCheckedChange={(v) => setValue("isFeatured", v)}
          />
        </div>
      </Field>
    </div>

    <FormInput
      name="sortOrder"
      label={tw("sortOrder")}
      type="number"
      min={0}
      max={9999}
    />

    <hr className="my-2" />
    <p className="text-sm font-medium">{tw("pricing")}</p>

    <FormSearchableSelect
      name="pricingModel"
      label={tw("pricingModel")}
      options={pricingModelOptions}
    />

    {pricingModel !== "free" && (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormInput
          name="priceInCents"
          label={tw("priceInCents")}
          type="number"
          min={0}
        />
        <FormSelect
          name="billingInterval"
          label={tw("billingInterval")}
          options={billingIntervalOptions}
        />
        <FormInput
          name="trialDays"
          label={tw("trialDays")}
          type="number"
          min={0}
          max={365}
        />
      </div>
    )}
    </>
  );
}
