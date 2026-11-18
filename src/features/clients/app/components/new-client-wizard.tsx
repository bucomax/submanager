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
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/shared/components/ui/card";
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

  const steps: { n: NewClientWizardStep; label: string }[] = [
    { n: 1, label: t("step1") },
    { n: 2, label: t("step2") },
    { n: 3, label: t("step3") },
  ];

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="sr-only">{t("title")}</CardTitle>
        {/* Kit: passos com progresso visível; concluído em verde com check, atual em tinta. */}
        <ol className="flex flex-wrap items-center gap-2" aria-label={t("title")}>
          {steps.map(({ n, label }, i) => {
            const done = step > n;
            const current = step === n;
            return (
              <li key={n} className="flex items-center gap-2" aria-current={current ? "step" : undefined}>
                {i > 0 ? <span aria-hidden className="bg-input h-px w-8 sm:w-10" /> : null}
                <span
                  className={cn(
                    "flex items-center gap-2.5 text-sm font-semibold",
                    current ? "text-foreground" : done ? "text-success" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-7 place-items-center rounded-full border-[1.5px] text-[13px] tabular-nums transition-colors duration-150",
                      current && "border-primary bg-primary text-primary-foreground",
                      done && "border-success-soft bg-success-soft text-success",
                      !current && !done && "border-input",
                    )}
                  >
                    {done ? <Check className="size-3.5" aria-hidden /> : n}
                  </span>
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
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
      <CardFooter className="flex flex-wrap justify-end gap-2 border-t">
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
