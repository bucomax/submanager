"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Loader2, Save, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";

import { ManualSetPasswordDialog } from "@/features/settings/app/components/manual-set-password-dialog";

import {
  createTenantWizardSchema,
  type CreateTenantWizardValues,
} from "@/features/settings/app/utils/schemas";
import { digitsOnlyCep, formatCepDisplay } from "@/lib/validators/cep";
import { digitsOnlyTaxDocument, formatTaxDocumentDisplay } from "@/lib/validators/tax-document";
import { digitsOnlyPhone, formatPhoneBrDisplay } from "@/lib/validators/phone";
import { slugifyTenantSlugFromName } from "@/lib/utils/string";
import { toast } from "@/lib/toast";
import type { CreateAdminTenantRequestBody, CreateAdminTenantResponseData } from "@/types/api/admin-tenants-v1";
import { Form, FormCep, FormInput, FormPhoneNumber, FormTaxDocument } from "@/shared/components/forms";
import { Button } from "@/shared/components/ui/button";
import { Dialog, StandardDialogContent } from "@/shared/components/ui/dialog";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3 | 4;

const STEP1_FIELDS: (keyof CreateTenantWizardValues)[] = ["name", "slug", "taxId", "phone"];
const STEP2_FIELDS: (keyof CreateTenantWizardValues)[] = [
  "postalCode",
  "addressLine",
  "addressNumber",
  "addressComp",
  "neighborhood",
  "city",
  "state",
];
const STEP3_FIELDS: (keyof CreateTenantWizardValues)[] = ["adminEmail", "adminName"];

const defaultValues: CreateTenantWizardValues = {
  name: "",
  slug: "",
  taxId: "",
  phone: "",
  postalCode: "",
  addressLine: "",
  addressNumber: "",
  addressComp: "",
  neighborhood: "",
  city: "",
  state: "",
  adminEmail: "",
  adminName: "",
};

export type CreateTenantWizardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  createTenant: (input: CreateAdminTenantRequestBody) => Promise<CreateAdminTenantResponseData>;
  creating: boolean;
};

function mergeTenantAddressLine(v: CreateTenantWizardValues): string | null {
  const street = v.addressLine?.trim() ?? "";
  const num = v.addressNumber?.trim() ?? "";
  const comp = v.addressComp?.trim() ?? "";
  const neighborhood = v.neighborhood?.trim() ?? "";

  let line = street;
  if (line && num) line = `${line}, ${num}`;
  else if (!line && num) line = num;
  if (comp) line = line ? `${line} - ${comp}` : comp;
  if (neighborhood) line = line ? `${line}, ${neighborhood}` : neighborhood;

  return line || null;
}

function buildRequestBody(v: CreateTenantWizardValues): CreateAdminTenantRequestBody {
  const adminEmail = v.adminEmail.trim();
  const addressLineMerged = mergeTenantAddressLine(v);
  const cityPart = v.city?.trim() ?? "";
  const statePart = (v.state ?? "").trim().toUpperCase().slice(0, 2);
  const cityMerged =
    cityPart || statePart ? [cityPart, statePart].filter(Boolean).join(" · ") : null;
  const cep = digitsOnlyCep(v.postalCode ?? "");
  return {
    name: v.name.trim(),
    slug: v.slug.trim(),
    taxId: (() => {
      const d = digitsOnlyTaxDocument(v.taxId ?? "");
      return d.length > 0 ? d : null;
    })(),
    phone: (() => {
      const d = digitsOnlyPhone(v.phone ?? "");
      return d.length > 0 ? d : null;
    })(),
    addressLine: addressLineMerged ? addressLineMerged.slice(0, 500) : null,
    city: cityMerged ? cityMerged.slice(0, 200) : null,
    postalCode: cep.length === 8 ? cep : null,
    admin: adminEmail
      ? { email: adminEmail, name: v.adminName?.trim() || null }
      : null,
  };
}

type ManualPasswordState = {
  open: boolean;
  userId: string;
  tenantId: string;
  email: string;
  name?: string | null;
};

export function CreateTenantWizardDialog({
  open,
  onOpenChange,
  createTenant,
  creating,
}: CreateTenantWizardDialogProps) {
  const t = useTranslations("settings.tenants");
  const tc = useTranslations("settings.clinic");

  const [step, setStep] = useState<Step>(1);
  const [slugTouched, setSlugTouched] = useState(false);
  const [manualPassword, setManualPassword] = useState<ManualPasswordState>({
    open: false,
    userId: "",
    tenantId: "",
    email: "",
  });

  const form = useForm<CreateTenantWizardValues>({
    resolver: zodResolver(createTenantWizardSchema),
    defaultValues,
  });

  const nameWatch = useWatch({ control: form.control, name: "name" });

  useEffect(() => {
    if (!open || slugTouched) return;
    const s = slugifyTenantSlugFromName(nameWatch ?? "");
    if (s.length >= 2) {
      form.setValue("slug", s, { shouldValidate: true, shouldDirty: false });
    }
  }, [open, slugTouched, nameWatch, form]);

  const goBack = useCallback(() => {
    setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
  }, []);

  const goNext = useCallback(() => {
    const fields =
      step === 1 ? STEP1_FIELDS : step === 2 ? STEP2_FIELDS : step === 3 ? STEP3_FIELDS : [];
    if (step >= 4) return;
    void form.trigger(fields).then((ok) => {
      if (ok) setStep((s) => ((s + 1) as Step));
    });
  }, [form, step]);

  const handleCreate = useCallback(async () => {
    const ok = await form.trigger();
    if (!ok) {
      setStep(1);
      return;
    }
    const v = form.getValues();
    try {
      const res = await createTenant(buildRequestBody(v));
      onOpenChange(false);
      toast.success(
        res.adminEmail
          ? t("wizard.createdWithAdmin", { name: res.tenant.name, email: res.adminEmail })
          : t("created", { name: res.tenant.name }),
      );
      if (res.adminEmail && res.emailDispatched === false) {
        toast.warning(t("wizard.emailNotSentWarning", { email: res.adminEmail }));
        if (res.adminUserId) {
          setManualPassword({
            open: true,
            userId: res.adminUserId,
            tenantId: res.tenant.id,
            email: res.adminEmail,
            name: v.adminName?.trim() || null,
          });
        }
      }
    } catch {
      /* apiClient / toast global */
    }
  }, [createTenant, form, onOpenChange, t]);

  const watched = useWatch({ control: form.control });

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

  const stepClass = (n: Step) =>
    cn(
      "flex size-7 items-center justify-center rounded-full text-xs font-medium transition-colors",
      step >= n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
    );

  function handleOpenChange(next: boolean) {
    if (creating && !next) return;
    onOpenChange(next);
  }

  return (
    <>
      <ManualSetPasswordDialog
        open={manualPassword.open}
        onOpenChange={(next) => setManualPassword((s) => ({ ...s, open: next }))}
        userId={manualPassword.userId}
        tenantId={manualPassword.tenantId}
        email={manualPassword.email}
        name={manualPassword.name}
      />
      <Dialog open={open} onOpenChange={handleOpenChange}>
      {open ? (
        <StandardDialogContent
          size="lg"
          showCloseButton={!creating}
          title={t("wizard.dialogTitle")}
          description={t("wizard.dialogDescription")}
          footer={
            <div className="flex w-full items-center justify-between gap-2">
              <div>
                {step > 1 ? (
                  <Button type="button" variant="outline" size="sm" disabled={creating} onClick={goBack}>
                    <ArrowLeft className="size-3.5" />
                    {t("wizard.back")}
                  </Button>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="text-muted-foreground mr-1 text-xs">{t("wizard.stepCounter", { step, total: 4 })}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={creating}
                  onClick={() => onOpenChange(false)}
                >
                  <X className="size-3.5" />
                  {t("wizard.cancel")}
                </Button>
                {step < 4 ? (
                  <Button type="button" size="sm" disabled={creating} onClick={goNext}>
                    {t("wizard.next")}
                    <ArrowRight className="size-3.5" />
                  </Button>
                ) : (
                  <Button type="button" size="sm" disabled={creating} onClick={() => void handleCreate()}>
                    {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                    {t("wizard.createButton")}
                  </Button>
                )}
              </div>
            </div>
          }
        >
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className={stepClass(1)}>1</div>
            <span className="text-muted-foreground text-xs">—</span>
            <div className={stepClass(2)}>2</div>
            <span className="text-muted-foreground text-xs">—</span>
            <div className={stepClass(3)}>3</div>
            <span className="text-muted-foreground text-xs">—</span>
            <div className={stepClass(4)}>4</div>
            <span className="text-muted-foreground ml-2 text-xs">
              {step === 1 && t("wizard.step1Label")}
              {step === 2 && t("wizard.step2Label")}
              {step === 3 && t("wizard.step3Label")}
              {step === 4 && t("wizard.step4Label")}
            </span>
          </div>

          <Form {...form}>
            <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
              {step === 1 ? (
                <>
                  <p className="text-muted-foreground text-sm">{t("wizard.step1Description")}</p>
                  <FormInput name="name" label={t("name")} placeholder={t("namePlaceholder")} autoFocus />
                  <FormInput
                    name="slug"
                    label={t("slug")}
                    placeholder={t("slugPlaceholder")}
                    onFocus={() => setSlugTouched(true)}
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
              ) : null}

              {step === 2 ? (
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
              ) : null}

              {step === 3 ? (
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
              ) : null}

              {step === 4 ? (
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
                      <p className="text-amber-700 dark:text-amber-400 text-sm">{t("wizard.noAdminWarning")}</p>
                    )}
                  </section>
                </div>
              ) : null}
            </form>
          </Form>
        </StandardDialogContent>
      ) : null}
      </Dialog>
    </>
  );
}
