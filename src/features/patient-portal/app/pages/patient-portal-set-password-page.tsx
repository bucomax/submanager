"use client";

import { PatientPortalFullScreenLoading } from "@/features/patient-portal/app/components/patient-portal-full-screen-loading";
import { usePatientPortalTenantSlug } from "@/features/patient-portal/app/context/patient-portal-tenant-context";
import { usePatientPortalPassword } from "@/features/patient-portal/app/hooks/use-patient-portal-password";
import { usePatientPortalSessionCheck } from "@/features/patient-portal/app/hooks/use-patient-portal-session";
import { isPortalSelfRegisterPasswordComplete } from "@/lib/validators/patient-portal-auth";
import { Link, useRouter } from "@/i18n/navigation";
import { toast } from "@/lib/toast";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button, buttonVariants } from "@/shared/components/ui/button";
import { PasswordStrengthIndicator } from "@/shared/components/forms/password-strength-indicator";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";

export function PatientPortalSetPasswordPage() {
  const tenantSlug = usePatientPortalTenantSlug();
  const t = useTranslations("patientPortal");
  const router = useRouter();
  const { loading: loadingSession, unauthorized } = usePatientPortalSessionCheck(tenantSlug);
  const { submitting, updatePassword } = usePatientPortalPassword(tenantSlug);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const ready = useMemo(
    () => isPortalSelfRegisterPasswordComplete(password, confirm),
    [password, confirm],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!ready) return;
    try {
      await updatePassword({ newPassword: password, confirmNewPassword: confirm });
      toast.success(t("setPassword.success"));
      router.replace(`/${tenantSlug}/patient`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("setPassword.error"));
    }
  }

  if (loadingSession) {
    return <PatientPortalFullScreenLoading message={t("setPassword.loading")} showMessage={false} />;
  }

  if (unauthorized) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Alert variant="destructive">
          <AlertDescription>{t("setPassword.needLogin")}</AlertDescription>
        </Alert>
        <Link href={`/${tenantSlug}/patient/login`} className={cn(buttonVariants({ variant: "default" }), "inline-flex w-full justify-center")}>
          {t("login.title")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("setPassword.title")}</h1>
        <p className="text-muted-foreground text-sm">{t("setPassword.description")}</p>
      </div>

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="set-pw">{t("setPassword.newPassword")}</Label>
          <Input
            id="set-pw"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="set-pw2">{t("setPassword.confirmPassword")}</Label>
          <Input
            id="set-pw2"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <PasswordStrengthIndicator
          password={password}
          confirmPassword={confirm}
          labelsNamespace="patientPortal.passwordStrength"
        />
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" className="w-full gap-2" disabled={submitting || !ready}>
          {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <KeyRound className="size-4" aria-hidden />}
          {submitting ? t("setPassword.submitting") : t("setPassword.submit")}
        </Button>
      </form>
    </div>
  );
}
