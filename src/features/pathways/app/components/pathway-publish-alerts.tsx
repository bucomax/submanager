"use client";

import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import type { PathwayPublishPreviewDto } from "@/types/api/pathways-v1";

type PathwayPublishAlertsProps = {
  readOnly: boolean;
  publishPreview: PathwayPublishPreviewDto | null;
  publishPreviewError: string | null;
  onRetryPreview: () => void;
};

/** Dica de rascunho/somente leitura + erro/bloqueios da pré-validação de publicação. */
export function PathwayPublishAlerts({
  readOnly,
  publishPreview,
  publishPreviewError,
  onRetryPreview,
}: PathwayPublishAlertsProps) {
  const t = useTranslations("pathways.editor");

  return (
    <>
      <Alert variant="info">
        <Info className="size-4 shrink-0" aria-hidden />
        <AlertDescription>{readOnly ? t("readOnlyHint") : t("draftHint")}</AlertDescription>
      </Alert>
      {publishPreviewError ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>{t("publishPreviewFailed")}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 border-destructive/50"
              onClick={onRetryPreview}
            >
              {t("publishPreviewRetry")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {publishPreview && !publishPreview.canPublish ? (
        <Alert variant="destructive">
          <AlertDescription className="space-y-2">
            <p className="font-medium text-destructive">{t("publishPreviewBlockedTitle")}</p>
            <ul className="list-inside list-disc text-sm">
              {publishPreview.issues.map((issue) => (
                <li key={issue.code}>{issue.message}</li>
              ))}
            </ul>
            {publishPreview.publishedStagePatientCounts.some((r) => r.patientCount > 0) ? (
              <ul className="border-border/60 text-muted-foreground mt-2 space-y-0.5 border-t pt-2 text-xs">
                {publishPreview.publishedStagePatientCounts
                  .filter((r) => r.patientCount > 0)
                  .map((r) => (
                    <li key={r.stageKey}>
                      {t("publishPreviewPatientsRow", { name: r.name, count: r.patientCount })}
                    </li>
                  ))}
              </ul>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}
