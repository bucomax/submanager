"use client";

import {
  isPatientPortalSessionExpired,
  usePatientPortalPassword,
} from "@/features/patient-portal/app/hooks/use-patient-portal-password";
import { isPortalSelfRegisterPasswordComplete } from "@/lib/validators/patient-portal-auth";
import { toast } from "@/lib/toast";
import { PasswordStrengthIndicator } from "@/shared/components/forms/password-strength-indicator";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Loader2, Save, X } from "lucide-react";

type PatientPortalPasswordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantSlug: string;
  hasPortalPassword: boolean;
};

export function PatientPortalPasswordDialog({
  open,
  onOpenChange,
  tenantSlug,
  hasPortalPassword,
}: PatientPortalPasswordDialogProps) {
  const t = useTranslations("patientPortal.passwordDialog");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const { submitting, updatePassword } = usePatientPortalPassword(tenantSlug);

  const ready = useMemo(() => {
    const strong = isPortalSelfRegisterPasswordComplete(newPassword, confirmNewPassword);
    if (!strong) return false;
    if (hasPortalPassword) return currentPassword.trim().length > 0;
    return true;
  }, [newPassword, confirmNewPassword, currentPassword, hasPortalPassword]);

  function resetFields() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    try {
      await updatePassword({
        newPassword,
        confirmNewPassword,
        ...(hasPortalPassword ? { currentPassword } : {}),
      });
      toast.success(t("success"));
      resetFields();
      onOpenChange(false);
    } catch (err) {
      if (isPatientPortalSessionExpired(err)) {
        toast.error(t("sessionExpired"));
        return;
      }
      toast.error(err instanceof Error ? err.message : t("error"));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetFields();
        onOpenChange(next);
      }}
    >
      <DialogContent showCloseButton>
        <form onSubmit={(e) => void onSubmit(e)}>
          <DialogHeader>
            <DialogTitle>{hasPortalPassword ? t("titleChange") : t("titleCreate")}</DialogTitle>
            <DialogDescription>{hasPortalPassword ? t("descriptionChange") : t("descriptionCreate")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {hasPortalPassword ? (
              <div className="space-y-2">
                <Label htmlFor="pp-cur-pw">{t("currentLabel")}</Label>
                <Input
                  id="pp-cur-pw"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="pp-new-pw">{t("newLabel")}</Label>
              <Input
                id="pp-new-pw"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pp-new-pw2">{t("confirmLabel")}</Label>
              <Input
                id="pp-new-pw2"
                type="password"
                autoComplete="new-password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
              />
            </div>
            <div className="bg-muted/30 border-border/80 space-y-3 rounded-xl border p-4 shadow-sm">
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                {t("requirementsTitle")}
              </p>
              <PasswordStrengthIndicator
                password={newPassword}
                confirmPassword={confirmNewPassword}
                labelsNamespace="patientPortal.passwordStrength"
                rulesTwoColumn
                className="space-y-0"
              />
            </div>
          </div>
          <DialogFooter className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 sm:w-auto"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4 shrink-0" aria-hidden />
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={submitting || !ready} className="w-full gap-2 sm:w-auto">
              {submitting ? (
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Save className="size-4 shrink-0" aria-hidden />
              )}
              {submitting ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
