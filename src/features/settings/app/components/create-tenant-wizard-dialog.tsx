"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslatedZodResolver } from "@/shared/lib/forms/translated-zod-resolver";
import { ArrowLeft, ArrowRight, Loader2, Save, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";

import { ManualSetPasswordDialog } from "@/features/settings/app/components/manual-set-password-dialog";

import {
  createTenantWizardSchema,
  type CreateTenantWizardValues,
} from "@/features/settings/app/utils/schemas";
import { slugifyTenantSlugFromName } from "@/lib/utils/string";
import {
  CreateTenantStepAddress,
  CreateTenantStepAdmin,
  CreateTenantStepIdentity,
} from "@/features/settings/app/components/create-tenant-wizard-fields";
import { CreateTenantReviewStep } from "@/features/settings/app/components/create-tenant-review-step";
import {
  STEP1_FIELDS,
  STEP2_FIELDS,
  STEP3_FIELDS,
  buildCreateTenantRequestBody,
  createTenantWizardDefaultValues,
  type CreateTenantWizardStep,
} from "@/features/settings/app/utils/create-tenant-wizard";
import { toast } from "@/lib/toast";
import type { CreateAdminTenantRequestBody, CreateAdminTenantResponseData } from "@/types/api/admin-tenants-v1";
import { Form } from "@/shared/components/forms";
import { Button } from "@/shared/components/ui/button";
import { Dialog, StandardDialogContent } from "@/shared/components/ui/dialog";
import { cn } from "@/lib/utils";

export type CreateTenantWizardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  createTenant: (input: CreateAdminTenantRequestBody) => Promise<CreateAdminTenantResponseData>;
  creating: boolean;
};

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

  const [step, setStep] = useState<CreateTenantWizardStep>(1);
  const [slugTouched, setSlugTouched] = useState(false);
  const [manualPassword, setManualPassword] = useState<ManualPasswordState>({
    open: false,
    userId: "",
    tenantId: "",
    email: "",
  });

  const resolver = useTranslatedZodResolver<CreateTenantWizardValues>(createTenantWizardSchema);
  const form = useForm<CreateTenantWizardValues>({
    resolver,
    defaultValues: createTenantWizardDefaultValues,
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
    setStep((s) => (s > 1 ? ((s - 1) as CreateTenantWizardStep) : s));
  }, []);

  const goNext = useCallback(() => {
    const fields =
      step === 1 ? STEP1_FIELDS : step === 2 ? STEP2_FIELDS : step === 3 ? STEP3_FIELDS : [];
    if (step >= 4) return;
    void form.trigger(fields).then((ok) => {
      if (ok) setStep((s) => ((s + 1) as CreateTenantWizardStep));
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
      const res = await createTenant(buildCreateTenantRequestBody(v));
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

  const stepClass = (n: CreateTenantWizardStep) =>
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
              {step === 1 ? <CreateTenantStepIdentity onSlugFocus={() => setSlugTouched(true)} /> : null}
              {step === 2 ? <CreateTenantStepAddress /> : null}
              {step === 3 ? <CreateTenantStepAdmin /> : null}
              {step === 4 ? <CreateTenantReviewStep /> : null}
            </form>
          </Form>
        </StandardDialogContent>
      ) : null}
      </Dialog>
    </>
  );
}
