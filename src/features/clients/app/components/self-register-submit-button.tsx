"use client";

import type { PatientSelfRegisterFormValues } from "@/features/clients/app/utils/schemas";
import { cn } from "@/lib/utils";
import { isPortalSelfRegisterPasswordComplete } from "@/lib/validators/patient-portal-auth";
import { buttonVariants } from "@/shared/components/ui/button";
import { Loader2, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";

/**
 * `<button type="submit">` nativo (não o `Button` Base UI) para o POST do formulário
 * disparar de forma confiável no browser + E2E. Só habilita com senha forte e aceites.
 */
export function SelfRegisterSubmitButton() {
  const t = useTranslations("clients");
  const form = useFormContext<PatientSelfRegisterFormValues>();
  const passwordWatched = useWatch({ control: form.control, name: "password" }) ?? "";
  const confirmPasswordWatched = useWatch({ control: form.control, name: "confirmPassword" }) ?? "";
  const acceptTermsWatched = useWatch({ control: form.control, name: "acceptTerms" }) === true;
  const acceptPrivacyWatched = useWatch({ control: form.control, name: "acceptPrivacy" }) === true;

  const portalPasswordReady = useMemo(
    () => isPortalSelfRegisterPasswordComplete(passwordWatched, confirmPasswordWatched),
    [passwordWatched, confirmPasswordWatched],
  );
  const consentsReady = acceptTermsWatched && acceptPrivacyWatched;
  const { isSubmitting } = form.formState;

  return (
    <button
      type="submit"
      data-testid="patient-self-register-submit"
      disabled={isSubmitting || !portalPasswordReady || !consentsReady}
      className={cn(
        buttonVariants({ variant: "default", size: "default" }),
        "inline-flex w-full items-center justify-center gap-2",
      )}
    >
      {isSubmitting ? (
        <>
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          {t("selfRegister.submitting")}
        </>
      ) : (
        <>
          <Send className="size-4 shrink-0" aria-hidden />
          {t("selfRegister.submit")}
        </>
      )}
    </button>
  );
}
