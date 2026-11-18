"use client";

import { useTranslations } from "next-intl";
import { FormCep, FormInput, FormPhoneNumber, FormTaxDocument } from "@/shared/components/forms";

/** Passo 1: identificação. `onSlugFocus` marca o slug como editado à mão (para de acompanhar o nome). */
export function CreateTenantStepIdentity({ onSlugFocus }: { onSlugFocus: () => void }) {
  const t = useTranslations("settings.tenants");
  const tc = useTranslations("settings.clinic");

  return (
    <>
      <p className="text-muted-foreground text-sm">{t("wizard.step1Description")}</p>
      <FormInput name="name" label={t("name")} placeholder={t("namePlaceholder")} autoFocus />
      <FormInput
        name="slug"
        label={t("slug")}
        placeholder={t("slugPlaceholder")}
        onFocus={onSlugFocus}
      />
      <FormTaxDocument
        name="taxId"
        label={tc("taxId")}
        placeholder={tc("taxIdPlaceholder")}
        className="tabular-nums"
      />
      <FormPhoneNumber
        name="phone"
        label={tc("phone")}
        placeholder={tc("phonePlaceholder")}
        className="tabular-nums"
      />
    </>
  );
}

/** Passo 2: endereço. */
export function CreateTenantStepAddress() {
  const t = useTranslations("settings.tenants");

  return (
    <>
      <p className="text-muted-foreground text-sm">{t("wizard.step2Description")}</p>
      <div className="bg-muted/40 space-y-4 rounded-lg border p-4">
        <p className="text-sm font-medium">{t("wizard.addressSectionTitle")}</p>
        <div className="grid gap-4 lg:grid-cols-2">
          <FormCep
            name="postalCode"
            label={t("wizard.postalCodeLabel")}
            description={t("wizard.postalCodeHint")}
          />
          <FormInput
            name="addressLine"
            label={t("wizard.streetLabel")}
            placeholder={t("wizard.streetPlaceholder")}
            autoComplete="street-address"
          />
          <FormInput name="addressNumber" label={t("wizard.addressNumberLabel")} autoComplete="off" />
          <FormInput name="addressComp" label={t("wizard.addressCompLabel")} required={false} />
          <FormInput
            name="neighborhood"
            label={t("wizard.neighborhoodLabel")}
            placeholder={t("wizard.neighborhoodPlaceholder")}
          />
          <FormInput
            name="city"
            label={t("wizard.cityLabel")}
            placeholder={t("wizard.cityPlaceholder")}
            autoComplete="address-level2"
          />
          <FormInput
            name="state"
            label={t("wizard.stateLabel")}
            placeholder={t("wizard.statePlaceholder")}
            maxLength={2}
            className="uppercase tabular-nums"
            autoComplete="address-level1"
          />
        </div>
      </div>
    </>
  );
}

/** Passo 3: administrador inicial. */
export function CreateTenantStepAdmin() {
  const t = useTranslations("settings.tenants");

  return (
    <>
      <p className="text-muted-foreground text-sm">{t("wizard.step3Description")}</p>
      <p className="text-muted-foreground text-xs">{t("wizard.adminHint")}</p>
      <FormInput
        name="adminEmail"
        label={t("wizard.adminEmailLabel")}
        placeholder={t("wizard.adminEmailPlaceholder")}
        type="email"
        autoComplete="email"
      />
      <FormInput name="adminName" label={t("wizard.adminNameLabel")} placeholder={t("wizard.adminNamePlaceholder")} />
    </>
  );
}
