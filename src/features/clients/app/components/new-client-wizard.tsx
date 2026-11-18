"use client";

import { NewClientPathwayStep } from "@/features/clients/app/components/new-client-step-pathway";
import { NewClientPatientStep } from "@/features/clients/app/components/new-client-step-patient";
import { NewClientReviewStep } from "@/features/clients/app/components/new-client-step-review";
import {
  useNewClientWizard,
  type NewClientWizardStep,
} from "@/features/clients/app/hooks/use-new-client-wizard";
import { cn } from "@/lib/utils";
import { Form } from "@/shared/components/forms";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

export type NewClientWizardProps = {
  /** `callback`: fecha modal / chama `onFlowComplete` sem redirecionar. Padrão: lista de clientes. */
  submitBehavior?: "navigateToClients" | "callback";
  onFlowComplete?: () => void;
};

export function NewClientWizard({
  submitBehavior = "navigateToClients",
  onFlowComplete,
}: NewClientWizardProps = {}) {
  const t = useTranslations("clients.wizard");
  const wizard = useNewClientWizard({ submitBehavior, onFlowComplete });
  const { step, submitting, pathwayOptions, pickers } = wizard;

  const stepClass = (n: NewClientWizardStep) =>
    cn(
      "flex size-8 items-center justify-center rounded-full text-sm font-medium",
      step >= n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
    );

  return (
    <Card className="border-border shadow-sm">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <div className={stepClass(1)}>1</div>
          <span className="text-muted-foreground hidden sm:inline">—</span>
          <div className={stepClass(2)}>2</div>
          <span className="text-muted-foreground hidden sm:inline">—</span>
          <div className={stepClass(3)}>3</div>
        </div>
        <CardTitle className="sr-only">{t("title")}</CardTitle>
        <CardDescription className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-xs">
          <span className={step === 1 ? "text-foreground font-medium" : ""}>{t("step1")}</span>
          <span className={step === 2 ? "text-foreground font-medium" : ""}>{t("step2")}</span>
          <span className={step === 3 ? "text-foreground font-medium" : ""}>{t("step3")}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...wizard.form}>
          {step === 1 ? (
            <NewClientPatientStep
              sessionReady={wizard.sessionReady}
              members={pickers.members}
              suppliers={pickers.suppliers}
              pickersError={pickers.error}
              assignedToUserId={wizard.assignedToUserId}
              onAssignedChange={wizard.setAssignedToUserId}
              opmeSupplierId={wizard.opmeSupplierId}
              onOpmeChange={wizard.setOpmeSupplierId}
            />
          ) : null}
          {step === 2 ? (
            <NewClientPathwayStep
              eligiblePathways={pathwayOptions.eligiblePathways}
              loading={pathwayOptions.loading}
              error={pathwayOptions.error}
              pathwayId={wizard.pathwayId}
              onPathwayChange={wizard.setPathwayId}
            />
          ) : null}
          {step === 3 ? <NewClientReviewStep selectedPathway={wizard.selectedPathway} /> : null}
        </Form>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 border-t">
        {step > 1 ? (
          <Button type="button" variant="outline" size="sm" onClick={wizard.goBack} disabled={submitting}>
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            {t("back")}
          </Button>
        ) : null}
        {step === 1 ? (
          <Button type="button" size="sm" onClick={wizard.goNextFromStep1}>
            {t("next")}
            <ArrowRight className="size-4 shrink-0" aria-hidden />
          </Button>
        ) : null}
        {step === 2 ? (
          <Button
            type="button"
            size="sm"
            onClick={wizard.goNextFromStep2}
            disabled={pathwayOptions.eligiblePathways.length === 0}
          >
            {t("next")}
            <ArrowRight className="size-4 shrink-0" aria-hidden />
          </Button>
        ) : null}
        {step === 3 ? (
          <Button type="button" size="sm" onClick={() => void wizard.handleSubmitAll()} disabled={submitting}>
            {submitting ? (
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Check className="size-4 shrink-0" aria-hidden />
            )}
            {submitting ? t("submitting") : t("submit")}
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
