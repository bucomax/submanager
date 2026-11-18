"use client";

import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import type { CreateTenantWizardValues } from "@/features/settings/app/utils/schemas";
import { formatCepDisplay } from "@/lib/validators/cep";
import { formatPhoneBrDisplay } from "@/lib/validators/phone";
import { formatTaxDocumentDisplay } from "@/lib/validators/tax-document";

/** Passo 4: revisão dos dados antes de criar a clínica. */
export function CreateTenantReviewStep() {
  const t = useTranslations("settings.tenants");
  const tc = useTranslations("settings.clinic");
  const { control } = useFormContext<CreateTenantWizardValues>();
  const watched = useWatch({ control });

  const reviewAddress = useMemo(() => {
    const parts = [
      watched?.postalCode,
      watched?.addressLine,
      watched?.addressNumber,
      watched?.addressComp,
      watched?.neighborhood,
      watched?.city,
      watched?.state,
    ]
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean);
    return parts.length > 0;
  }, [
    watched?.postalCode,
    watched?.addressLine,
    watched?.addressNumber,
    watched?.addressComp,
    watched?.neighborhood,
    watched?.city,
    watched?.state,
  ]);

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">{t("wizard.step4Description")}</p>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">{t("wizard.reviewIdentification")}</h3>
        <dl className="grid gap-2 text-sm sm:grid-cols-[minmax(0,140px)_1fr]">
          <dt className="text-muted-foreground">{t("name")}</dt>
          <dd className="min-w-0 font-medium">{watched?.name}</dd>
          <dt className="text-muted-foreground">{t("slug")}</dt>
          <dd className="min-w-0 font-mono text-sm">{watched?.slug}</dd>
          {watched?.taxId ? (
            <>
              <dt className="text-muted-foreground">{tc("taxId")}</dt>
              <dd className="tabular-nums">{formatTaxDocumentDisplay(String(watched.taxId))}</dd>
            </>
          ) : null}
          {watched?.phone ? (
            <>
              <dt className="text-muted-foreground">{tc("phone")}</dt>
              <dd className="tabular-nums">{formatPhoneBrDisplay(String(watched.phone))}</dd>
            </>
          ) : null}
        </dl>
      </section>

      {reviewAddress ? (
        <section className="space-y-2">
          <h3 className="text-sm font-medium">{t("wizard.reviewAddress")}</h3>
          <dl className="grid gap-2 text-sm sm:grid-cols-[minmax(0,140px)_1fr]">
            {watched?.postalCode && String(watched.postalCode).replace(/\D/g, "").length > 0 ? (
              <>
                <dt className="text-muted-foreground">{t("wizard.postalCodeLabel")}</dt>
                <dd className="tabular-nums">{formatCepDisplay(String(watched.postalCode))}</dd>
              </>
            ) : null}
            {watched?.addressLine ? (
              <>
                <dt className="text-muted-foreground">{t("wizard.streetLabel")}</dt>
                <dd>{watched.addressLine}</dd>
              </>
            ) : null}
            {watched?.addressNumber ? (
              <>
                <dt className="text-muted-foreground">{t("wizard.addressNumberLabel")}</dt>
                <dd>{watched.addressNumber}</dd>
              </>
            ) : null}
            {watched?.addressComp ? (
              <>
                <dt className="text-muted-foreground">{t("wizard.addressCompLabel")}</dt>
                <dd>{watched.addressComp}</dd>
              </>
            ) : null}
            {watched?.neighborhood ? (
              <>
                <dt className="text-muted-foreground">{t("wizard.neighborhoodLabel")}</dt>
                <dd>{watched.neighborhood}</dd>
              </>
            ) : null}
            {watched?.city ? (
              <>
                <dt className="text-muted-foreground">{t("wizard.cityLabel")}</dt>
                <dd>{watched.city}</dd>
              </>
            ) : null}
            {watched?.state ? (
              <>
                <dt className="text-muted-foreground">{t("wizard.stateLabel")}</dt>
                <dd className="uppercase">{watched.state}</dd>
              </>
            ) : null}
          </dl>
        </section>
      ) : null}

      <section className="space-y-2">
        <h3 className="text-sm font-medium">{t("wizard.reviewAdmin")}</h3>
        {watched?.adminEmail?.trim() ? (
          <dl className="grid gap-2 text-sm sm:grid-cols-[minmax(0,140px)_1fr]">
            <dt className="text-muted-foreground">{t("wizard.adminEmailLabel")}</dt>
            <dd>{watched.adminEmail}</dd>
            {watched?.adminName?.trim() ? (
              <>
                <dt className="text-muted-foreground">{t("wizard.adminNameLabel")}</dt>
                <dd>{watched.adminName}</dd>
              </>
            ) : null}
          </dl>
        ) : (
          <p className="text-warning text-sm">{t("wizard.noAdminWarning")}</p>
        )}
      </section>
    </div>
  );
}
