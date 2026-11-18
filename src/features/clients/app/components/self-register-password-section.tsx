"use client";

import type { PatientSelfRegisterFormValues } from "@/features/clients/app/utils/schemas";
import { FormPassword, PasswordStrengthIndicator } from "@/shared/components/forms";
import { useTranslations } from "next-intl";
import { useFormContext, useWatch } from "react-hook-form";

/** Senha do portal + indicador de força/requisitos. */
export function SelfRegisterPasswordSection() {
  const t = useTranslations("clients");
  const form = useFormContext<PatientSelfRegisterFormValues>();
  const passwordWatched = useWatch({ control: form.control, name: "password" }) ?? "";
  const confirmPasswordWatched = useWatch({ control: form.control, name: "confirmPassword" }) ?? "";

  return (
    <div className="bg-muted/40 space-y-4 rounded-lg border p-4">
      <div className="space-y-4">
        <FormPassword
          name="password"
          label={t("selfRegister.passwordStrength.passwordLabel")}
          description={t("selfRegister.passwordStrength.passwordHint")}
          autoComplete="new-password"
        />
        <FormPassword
          name="confirmPassword"
          label={t("selfRegister.passwordStrength.confirmLabel")}
          autoComplete="new-password"
        />
      </div>
      <div className="bg-muted/30 border-border/80 space-y-3 rounded-xl border p-4 shadow-sm">
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {t("selfRegister.passwordStrength.requirementsTitle")}
        </p>
        <PasswordStrengthIndicator
          password={passwordWatched}
          confirmPassword={confirmPasswordWatched}
          labelsNamespace="clients.selfRegister.passwordStrength"
          rulesTwoColumn
          className="space-y-0"
        />
      </div>
    </div>
  );
}
