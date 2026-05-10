"use client";

import { useEffect } from "react";
import { useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { KeyRound, Loader2, TriangleAlert, X } from "lucide-react";

import { useManualSetPassword } from "@/features/settings/app/hooks/use-manual-set-password";
import { Form, FormPassword } from "@/shared/components/forms";
import { PasswordStrengthIndicator } from "@/shared/components/forms/password-strength-indicator";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Dialog, StandardDialogContent } from "@/shared/components/ui/dialog";

const FORM_ID = "manual-set-password-form";

export type ManualSetPasswordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  tenantId: string;
  email: string;
  name?: string | null;
  hasExistingPassword?: boolean;
  onSuccess?: () => void;
};

export function ManualSetPasswordDialog({
  open,
  onOpenChange,
  userId,
  tenantId,
  email,
  name,
  hasExistingPassword = false,
  onSuccess,
}: ManualSetPasswordDialogProps) {
  const t = useTranslations("settings.manualSetPassword");
  const tStrength = useTranslations("clients.selfRegister.passwordStrength");

  const mode = hasExistingPassword ? "reset" : "set";

  const { form, onSubmit, isSubmitting } = useManualSetPassword({
    userId,
    tenantId,
    mode,
    onSuccess,
    onOpenChange,
  });

  const password = useWatch({ control: form.control, name: "password" }) ?? "";
  const confirmPassword = useWatch({ control: form.control, name: "confirmPassword" }) ?? "";

  useEffect(() => {
    if (open) return;
    form.reset({ password: "", confirmPassword: "" });
  }, [open, form]);

  function handleOpenChange(next: boolean) {
    if (isSubmitting && !next) return;
    onOpenChange(next);
  }

  const displayName = name?.trim() || email;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {open ? (
        <StandardDialogContent
          size="default"
          showCloseButton={!isSubmitting}
          title={hasExistingPassword ? t("titleReset") : t("title")}
          description={
            hasExistingPassword
              ? t("descriptionReset", { displayName })
              : t("description", { displayName })
          }
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5"
                disabled={isSubmitting}
                onClick={() => onOpenChange(false)}
              >
                <X className="size-4 shrink-0" aria-hidden />
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                form={FORM_ID}
                disabled={isSubmitting}
                className="gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <KeyRound className="size-4 shrink-0" aria-hidden />
                )}
                {hasExistingPassword ? t("submitReset") : t("submit")}
              </Button>
            </>
          }
        >
          <Form {...form}>
            <form id={FORM_ID} onSubmit={onSubmit} className="space-y-4">
              {hasExistingPassword ? (
                <Alert variant="warning">
                  <TriangleAlert aria-hidden />
                  <AlertDescription>{t("overrideAlert")}</AlertDescription>
                </Alert>
              ) : null}
              <div className="bg-muted/40 space-y-4 rounded-lg border p-4">
                <div className="space-y-4">
                  <FormPassword
                    name="password"
                    label={t("passwordLabel")}
                    autoComplete="new-password"
                  />
                  <FormPassword
                    name="confirmPassword"
                    label={t("confirmPasswordLabel")}
                    autoComplete="new-password"
                  />
                </div>
                <div className="bg-muted/30 border-border/80 space-y-3 rounded-xl border p-4 shadow-sm">
                  <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    {tStrength("requirementsTitle")}
                  </p>
                  <PasswordStrengthIndicator
                    password={password}
                    confirmPassword={confirmPassword}
                    labelsNamespace="clients.selfRegister.passwordStrength"
                    rulesTwoColumn
                    className="space-y-0"
                  />
                </div>
              </div>
            </form>
          </Form>
        </StandardDialogContent>
      ) : null}
    </Dialog>
  );
}
