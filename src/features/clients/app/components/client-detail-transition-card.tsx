"use client";

import { ClientDetailCardTitle } from "@/features/clients/app/components/client-detail-card-title";
import type { useClientStageTransition } from "@/features/clients/app/hooks/use-client-stage-transition";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/shared/components/ui/card";
import { Dialog, StandardDialogContent } from "@/shared/components/ui/dialog";
import { Field, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import type { ClientPatientPathwayDetailDto } from "@/types/api/clients-v1";
import { ArrowRightLeft, Check, ClipboardCheck, ExternalLink, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";

type ClientDetailTransitionCardProps = {
  pp: ClientPatientPathwayDetailDto;
  transition: ReturnType<typeof useClientStageTransition>;
};

/** Card "mudar de etapa" + diálogo de confirmação (com override de checklist e documentos da etapa). */
export function ClientDetailTransitionCard({ pp, transition }: ClientDetailTransitionCardProps) {
  const t = useTranslations("clients.detail");
  const tp = useTranslations("pathways.patient");

  return (
    <>
      <Card className="min-w-0">
        <CardHeader>
          <ClientDetailCardTitle icon={ArrowRightLeft}>{t("transition.title")}</ClientDetailCardTitle>
          <CardDescription>{t("transition.description")}</CardDescription>
        </CardHeader>
        <CardContent className="w-full min-w-0 space-y-4">
          <Field>
            <FieldLabel>{tp("toStage")}</FieldLabel>
            <Select
              value={transition.toStageId || undefined}
              onValueChange={(v) => transition.setToStageId(v ?? "")}
            >
              <SelectTrigger className="w-full min-w-0">
                <SelectValue placeholder={tp("toStagePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {transition.nextOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="client-detail-note">{tp("note")}</FieldLabel>
            <Input
              id="client-detail-note"
              value={transition.note}
              onChange={(e) => transition.setNote(e.target.value)}
              placeholder="—"
              className="w-full min-w-0"
            />
          </Field>
          <Button
            type="button"
            size="sm"
            onClick={() => transition.openTransitionConfirm()}
            disabled={transition.submitting || transition.nextOptions.length === 0 || !transition.toStageId}
          >
            <ClipboardCheck className="size-4 shrink-0" aria-hidden />
            {t("transition.review")}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={transition.confirmOpen} onOpenChange={transition.handleConfirmOpenChange}>
        <StandardDialogContent
          size="sm"
          showCloseButton={!transition.submitting}
          title={t("transition.confirmTitle")}
          description={t("transition.confirmDescription")}
          bodyClassName="py-3"
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => transition.setConfirmOpen(false)}
                disabled={transition.submitting}
              >
                <X className="size-4 shrink-0" aria-hidden />
                {t("transition.cancelConfirm")}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void transition.executeTransition()}
                disabled={transition.submitting}
              >
                {transition.submitting ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <Check className="size-4 shrink-0" aria-hidden />
                )}
                {t("transition.confirmSubmit")}
              </Button>
            </>
          }
        >
          <div className="text-sm">
            <p>
              <span className="text-muted-foreground">{t("transition.summaryFrom")} </span>
              <span className="font-medium">{pp.currentStage?.name ?? "—"}</span>
            </p>
            <p className="mt-2">
              <span className="text-muted-foreground">{t("transition.summaryTo")} </span>
              <span className="font-medium">{transition.targetStageName || "—"}</span>
            </p>
            {transition.note.trim() ? (
              <p className="text-muted-foreground mt-3 text-xs">
                {t("transition.notePreview", { text: transition.note.trim() })}
              </p>
            ) : null}
            {transition.incompleteRequiredChecklist.length > 0 ? (
              <div className="mt-4 border-t pt-3">
                <Alert variant="destructive" className="mb-3">
                  <AlertDescription className="text-sm">
                    {t("transition.blockedByChecklist")}
                  </AlertDescription>
                </Alert>
                <Field>
                  <FieldLabel htmlFor="client-detail-override">
                    {t("transition.overrideReasonLabel")}
                  </FieldLabel>
                  <textarea
                    id="client-detail-override"
                    rows={3}
                    maxLength={2000}
                    value={transition.overrideReason}
                    onChange={(e) => transition.setOverrideReason(e.target.value)}
                    disabled={transition.submitting}
                    placeholder={t("transition.overrideReasonPlaceholder")}
                    className={cn(
                      "border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-[4rem] w-full rounded-lg border px-2.5 py-2 text-sm transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
                    )}
                  />
                </Field>
                <p className="text-muted-foreground mt-1 text-xs">{t("transition.overrideReasonHint")}</p>
              </div>
            ) : null}
            <div className="mt-4 border-t pt-3">
              <p className="text-muted-foreground text-xs font-medium">
                {t("transition.stageDocumentsTitle")}
              </p>
              {transition.targetStageDocuments.length === 0 ? (
                <p className="text-muted-foreground mt-1 text-xs">{t("transition.stageDocumentsEmpty")}</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {transition.targetStageDocuments.map((d) => (
                    <li
                      key={d.id}
                      className="border-border/70 bg-muted/25 flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2"
                    >
                      <span className="text-foreground min-w-0 flex-1 truncate text-xs font-medium">
                        {d.file.fileName}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        className="h-7 w-7 shrink-0"
                        disabled={transition.stageDocDownloadingId === d.file.id}
                        onClick={() => void transition.openStageDocument(d.file.id)}
                        aria-label={t("transition.openStageDocumentAria")}
                      >
                        {transition.stageDocDownloadingId === d.file.id ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        ) : (
                          <ExternalLink className="size-3.5" aria-hidden />
                        )}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </StandardDialogContent>
      </Dialog>
    </>
  );
}
