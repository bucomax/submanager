"use client";

import type { RemoveStageDialogState } from "@/features/pathways/app/hooks/use-remove-stage-request";
import { Button } from "@/shared/components/ui/button";
import { Dialog, StandardDialogContent } from "@/shared/components/ui/dialog";

type PathwayRemoveStageDialogProps = {
  state: RemoveStageDialogState | null;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  /** Recebe o estado para interpolar nome e contagem de pacientes. */
  getDescription: (state: RemoveStageDialogState) => string;
  cancelLabel: string;
  confirmLabel: string;
};

/** Confirmação ao remover etapa que ainda tem pacientes. Textos vêm do chamador (namespaces i18n diferem). */
export function PathwayRemoveStageDialog({
  state,
  onCancel,
  onConfirm,
  title,
  getDescription,
  cancelLabel,
  confirmLabel,
}: PathwayRemoveStageDialogProps) {
  return (
    <Dialog
      open={state !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      {state ? (
        <StandardDialogContent
          title={title}
          description={getDescription(state)}
          size="sm"
          footer={
            <>
              <Button type="button" variant="outline" size="sm" onClick={onCancel}>
                {cancelLabel}
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </>
          }
        >
          <span className="sr-only">{title}</span>
        </StandardDialogContent>
      ) : null}
    </Dialog>
  );
}
