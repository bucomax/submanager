"use client";

import { completePatientPathway } from "@/features/pathways/app/services/patient-pathways.service";
import { toast } from "@/lib/toast";
import { Button } from "@/shared/components/ui/button";
import { Dialog, StandardDialogContent } from "@/shared/components/ui/dialog";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Check, Info, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

type ClientDetailSwitchPathwayHintProps = {
  patientPathwayId: string;
  onCompleted: () => void;
};

export function ClientDetailSwitchPathwayHint({
  patientPathwayId,
  onCompleted,
}: ClientDetailSwitchPathwayHintProps) {
  const t = useTranslations("clients.detail");
  const [open, setOpen] = useState(false);
  const [completing, setCompleting] = useState(false);

  async function handleConfirm() {
    setCompleting(true);
    try {
      await completePatientPathway(patientPathwayId);
      toast.success(t("switchPathway.completeSuccess"));
      setOpen(false);
      onCompleted();
    } catch {
      /* erro: toast global no apiClient */
    } finally {
      setCompleting(false);
    }
  }

  return (
    <>
      <Alert variant="info">
        <Info className="size-4 shrink-0" aria-hidden />
        <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm leading-snug">{t("switchPathway.hint")}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 self-start sm:self-auto"
            onClick={() => setOpen(true)}
          >
            {t("switchPathway.action")}
          </Button>
        </AlertDescription>
      </Alert>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!completing) setOpen(next);
        }}
      >
        <StandardDialogContent
          size="sm"
          showCloseButton={!completing}
          title={t("switchPathway.dialogTitle")}
          description={t("switchPathway.dialogDescription")}
          bodyClassName="py-3"
          footer={
            <>
              <Button type="button" variant="outline" size="sm" disabled={completing} onClick={() => setOpen(false)}>
                <X className="size-4 shrink-0" aria-hidden />
                {t("switchPathway.cancel")}
              </Button>
              <Button type="button" size="sm" disabled={completing} onClick={() => void handleConfirm()}>
                {completing ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <Check className="size-4 shrink-0" aria-hidden />
                )}
                {completing ? t("switchPathway.completing") : t("switchPathway.confirm")}
              </Button>
            </>
          }
        >
          <span className="sr-only">{t("switchPathway.dialogTitle")}</span>
        </StandardDialogContent>
      </Dialog>
    </>
  );
}
