"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Loader2, Save, X } from "lucide-react";

import { AppWizardStepConfig } from "@/features/apps/app/components/app-wizard-step-config";
import { AppWizardStepIdentity } from "@/features/apps/app/components/app-wizard-step-identity";
import { AppWizardStepPreview } from "@/features/apps/app/components/app-wizard-step-preview";
import { useAppWizardForm } from "@/features/apps/app/hooks/use-app-wizard-form";
import type { WizardStep } from "@/features/apps/app/utils/app-wizard-schema";
import type { AppDto } from "@/types/api/apps-v1";
import { Dialog, StandardDialogContent } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Form } from "@/shared/components/forms";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editApp?: AppDto | null;
  onSaved: () => void;
};

/** Montado só enquanto aberto: o estado do wizard (form, passo, blobs) nasce limpo a cada abertura. */
export function AdminAppWizardDialog({ open, ...rest }: Props) {
  if (!open) return null;
  return <AdminAppWizardDialogBody {...rest} />;
}

function AdminAppWizardDialogBody({ onOpenChange, editApp, onSaved }: Omit<Props, "open">) {
  const t = useTranslations("apps.admin");
  const tw = useTranslations("apps.admin.wizard");
  const {
    form,
    step,
    isEdit,
    saving,
    iconBlobPreview,
    localScreenshots,
    setLocalScreenshots,
    handleIconFileSelected,
    goToStep2,
    goToStep3,
    goBack,
    handleSave,
  } = useAppWizardForm({ editApp, onSaved, onClose: () => onOpenChange(false) });

  const stepClass = (n: WizardStep) =>
    cn(
      "flex size-7 items-center justify-center rounded-full text-xs font-medium transition-colors",
      step >= n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
    );

  function handleDialogOpenChange(next: boolean) {
    if (saving && !next) return;
    onOpenChange(next);
  }

  return (
    <Dialog open onOpenChange={handleDialogOpenChange}>
      <StandardDialogContent
        size="lg"
        showCloseButton={!saving}
        title={isEdit ? t("editApp") : t("newApp")}
        footer={
          <div className="flex w-full items-center justify-between">
            <div>
              {step > 1 && (
                <Button type="button" variant="outline" size="sm" disabled={saving} onClick={goBack}>
                  <ArrowLeft className="size-3.5" />
                  {tw("back")}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => onOpenChange(false)}
              >
                <X className="size-3.5" />
                {tw("cancel")}
              </Button>
              {step < 3 ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={step === 1 ? goToStep2 : goToStep3}
                >
                  {tw("next")}
                  <ArrowRight className="size-3.5" />
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={saving}
                    onClick={() => void handleSave(false)}
                  >
                    {saving ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    {tw("saveDraft")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={saving}
                    onClick={() => void handleSave(true)}
                  >
                    {saving ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : null}
                    {tw("publishApp")}
                  </Button>
                </>
              )}
            </div>
          </div>
        }
      >
        {/* Step indicator */}
        <div className="mb-4 flex items-center gap-2">
          <div className={stepClass(1)}>1</div>
          <span className="text-muted-foreground text-xs">—</span>
          <div className={stepClass(2)}>2</div>
          <span className="text-muted-foreground text-xs">—</span>
          <div className={stepClass(3)}>3</div>
          <span className="ml-2 text-xs text-muted-foreground">
            {step === 1 && tw("step1")}
            {step === 2 && tw("step2")}
            {step === 3 && tw("preview")}
          </span>
        </div>

        <Form {...form}>
          <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
            {step === 1 && (
              <AppWizardStepIdentity
                editApp={editApp}
                onSaved={onSaved}
                iconBlobPreview={iconBlobPreview}
                onIconFileSelected={handleIconFileSelected}
                localScreenshots={localScreenshots}
                onLocalScreenshotsChange={setLocalScreenshots}
              />
            )}

            {step === 2 && <AppWizardStepConfig />}

            {step === 3 && (
              <AppWizardStepPreview
                values={form.getValues()}
                iconPreview={iconBlobPreview ?? editApp?.iconUrl ?? null}
                screenshotCount={(editApp?.screenshots.length ?? 0) + localScreenshots.length}
              />
            )}
          </form>
        </Form>
      </StandardDialogContent>
    </Dialog>
  );
}

