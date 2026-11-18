"use client";

import { AuthSuspenseFallback } from "@/features/auth/app/components/auth-suspense-fallback";
import { SelfRegisterConsentSection } from "@/features/clients/app/components/self-register-consent-section";
import { SelfRegisterPasswordSection } from "@/features/clients/app/components/self-register-password-section";
import { SelfRegisterPersonalSections } from "@/features/clients/app/components/self-register-personal-sections";
import { SelfRegisterSubmitButton } from "@/features/clients/app/components/self-register-submit-button";
import { useSelfRegisterForm } from "@/features/clients/app/hooks/use-self-register-form";
import { useSelfRegisterValidation } from "@/features/clients/app/hooks/use-self-register-validation";
import { Link } from "@/i18n/navigation";
import { formatBrCnpjDisplay } from "@/lib/utils/cnpj";
import { FullScreenLoading } from "@/shared/components/feedback/full-screen-loading";
import { Form, FormTextarea } from "@/shared/components/forms";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { useTranslations } from "next-intl";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function PatientSelfRegisterInner() {
  const t = useTranslations("clients");
  const tGlobal = useTranslations("global");
  const params = useParams();
  const tenantSlug = typeof params.tenantSlug === "string" ? params.tenantSlug : undefined;
  const rawToken = useSearchParams().get("token")?.trim() ?? "";
  const { phase: validationPhase, token, tenantName, tenantTaxId, formPrefill } =
    useSelfRegisterValidation(rawToken, tenantSlug);
  const { form, submitError, submitted, handleFormSubmit } = useSelfRegisterForm({
    token,
    tenantSlug,
    formPrefill,
  });
  const phase = submitted ? "success" : validationPhase;

  return (
    <div className="w-full">
      <p className="text-accent-foreground mb-6 inline-flex items-center gap-2 text-xs font-semibold tracking-[0.14em] uppercase before:h-px before:w-[18px] before:bg-brand before:content-['']">
        {t("selfRegister.pageDescription")}
      </p>

      {phase === "loading" ? <FullScreenLoading message={t("selfRegister.validating")} showMessage={false} /> : null}

      {phase === "invalid" ? (
        <Card className="w-full border">
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="text-xl">{t("selfRegister.invalidTokenTitle")}</CardTitle>
            <CardDescription>{t("selfRegister.invalidTokenBody")}</CardDescription>
          </CardHeader>
          <CardFooter className="border-border/60 border-t bg-muted/35 pt-4 dark:bg-muted/20">
            <Button nativeButton={false} variant="outline" className="w-full" render={<Link href="/login" />}>
              {tGlobal("home.login")}
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {phase === "form" ? (
        <Card className="@container/patient-register w-full border">
          <CardHeader className="space-y-4 pb-4">
            <CardTitle className="text-xl">{t("selfRegister.pageTitle")}</CardTitle>
            {tenantName ? (
              <div className="bg-primary/[0.07] ring-primary/15 dark:bg-primary/12 rounded-xl border border-primary/25 p-4 ring-1">
                <p className="text-muted-foreground mb-2 text-sm leading-snug">{t("selfRegister.registeringAsIntro")}</p>
                <p className="text-foreground text-xl font-bold leading-tight tracking-tight">{tenantName}</p>
                {tenantTaxId ? (
                  <p className="text-foreground mt-3 text-sm leading-relaxed">
                    <span className="text-muted-foreground font-medium">{t("selfRegister.registeringAsTaxLabel")}: </span>
                    <span className="font-bold tabular-nums">{formatBrCnpjDisplay(tenantTaxId)}</span>
                  </p>
                ) : null}
              </div>
            ) : (
              <CardDescription>{t("selfRegister.pageDescription")}</CardDescription>
            )}
            {formPrefill ? (
              <CardDescription className="text-muted-foreground text-sm">{t("selfRegister.scopedFormHint")}</CardDescription>
            ) : null}
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                data-testid="patient-self-register-form"
                data-e2e-token-ready={token ? "true" : "false"}
                noValidate
                onSubmit={handleFormSubmit}
                className="flex flex-col gap-4 pb-2"
              >
                <SelfRegisterPersonalSections />
                <SelfRegisterPasswordSection />
                <SelfRegisterConsentSection />
                <FormTextarea
                  name="caseDescription"
                  label={t("wizard.caseDescription")}
                  description={t("wizard.caseDescriptionHint")}
                  rows={3}
                />
                {submitError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{submitError}</AlertDescription>
                  </Alert>
                ) : null}
                <SelfRegisterSubmitButton />
              </form>
            </Form>
          </CardContent>
        </Card>
      ) : null}

      {phase === "success" ? (
        <Card
          data-testid="patient-self-register-success"
          className="w-full border"
        >
          <CardHeader className="space-y-4 pb-4">
            <CardTitle className="text-xl">{t("selfRegister.successTitle")}</CardTitle>
            <CardDescription className="space-y-4 text-base leading-relaxed">
              <span className="text-foreground block font-medium">{t("selfRegister.successBody")}</span>
              <span className="text-muted-foreground block text-sm leading-relaxed">{t("selfRegister.successContactHint")}</span>
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  );
}

export function PatientSelfRegisterPage() {
  return (
    <Suspense fallback={<AuthSuspenseFallback />}>
      <PatientSelfRegisterInner />
    </Suspense>
  );
}
