"use client";

import { useCallback, useEffect, useState } from "react";
import { useInviteUserForm } from "@/features/settings/app/hooks/use-invite-user-form";
import { ManualSetPasswordDialog } from "@/features/settings/app/components/manual-set-password-dialog";
import type { AdminInviteResult } from "@/features/settings/app/types/account";
import { Form, FormInput, FormSelect } from "@/shared/components/forms";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Dialog, StandardDialogContent } from "@/shared/components/ui/dialog";
import { Loader2, Send, X } from "lucide-react";

const FORM_ID = "team-invite-user-form";

type TeamInviteUserDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ManualPasswordState = {
  open: boolean;
  userId: string;
  tenantId: string;
  email: string;
};

export function TeamInviteUserDialog({ open, onOpenChange }: TeamInviteUserDialogProps) {
  const [manualPassword, setManualPassword] = useState<ManualPasswordState>({
    open: false,
    userId: "",
    tenantId: "",
    email: "",
  });

  const handleEmailNotSent = useCallback(
    (result: AdminInviteResult & { tenantId: string }) => {
      setManualPassword({
        open: true,
        userId: result.userId,
        tenantId: result.tenantId,
        email: result.email,
      });
    },
    [],
  );

  const { form, onSubmit, canInvite, sessionStatus, roleOptions, t } = useInviteUserForm({
    onSuccess: () => onOpenChange(false),
    onEmailNotSent: handleEmailNotSent,
  });

  const isSubmitting = form.formState.isSubmitting;

  useEffect(() => {
    if (open) return;
    form.reset({ email: "", name: "", role: "tenant_user" });
  }, [open, form]);

  function handleOpenChange(next: boolean) {
    if (isSubmitting && !next) return;
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
      />
      <Dialog open={open} onOpenChange={handleOpenChange}>
        {open ? (
          <StandardDialogContent
            size="default"
            showCloseButton={!isSubmitting}
            title={t("title")}
            description={t("description")}
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
                  {t("dialogCancel")}
                </Button>
                <Button
                  type="submit"
                  form={FORM_ID}
                  disabled={!canInvite || isSubmitting}
                  className="gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                  ) : (
                    <Send className="size-4 shrink-0" aria-hidden />
                  )}
                  {t("submit")}
                </Button>
              </>
            }
          >
            <Form {...form}>
              <form id={FORM_ID} onSubmit={onSubmit} className="space-y-4">
                {sessionStatus === "loading" ? (
                  <Alert>
                    <AlertDescription>{t("loadingSession")}</AlertDescription>
                  </Alert>
                ) : null}
                {!canInvite ? (
                  <Alert variant="destructive">
                    <AlertDescription>{t("forbidden")}</AlertDescription>
                  </Alert>
                ) : null}
                <FormInput
                  name="email"
                  label={t("email")}
                  type="email"
                  autoComplete="email"
                  placeholder="profissional@empresa.com"
                  disabled={!canInvite}
                />
                <FormInput
                  name="name"
                  label={t("name")}
                  autoComplete="name"
                  placeholder={t("namePlaceholder")}
                  disabled={!canInvite}
                />
                <FormSelect
                  name="role"
                  label={t("role")}
                  options={roleOptions}
                  disabled={!canInvite}
                />
              </form>
            </Form>
          </StandardDialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
