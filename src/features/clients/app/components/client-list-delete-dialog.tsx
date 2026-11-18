"use client";

import { useDeleteClient } from "@/features/clients/app/hooks/use-delete-client";
import { toast } from "@/lib/toast";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Dialog, StandardDialogContent } from "@/shared/components/ui/dialog";
import { Field, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

type ClientListDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string | null;
  clientName: string;
};

export function ClientListDeleteDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
}: ClientListDeleteDialogProps) {
  const t = useTranslations("clients.list.deleteDialog");
  const { deleting, deleteClient } = useDeleteClient();

  const [confirmText, setConfirmText] = useState("");
  const [prevOpen, setPrevOpen] = useState(open);
  // Zera o texto de confirmação ao fechar (ajuste de estado no render, sem efeito).
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) setConfirmText("");
  }

  const expectedWord = t("confirmWord");
  const matches =
    confirmText.trim().toLowerCase() === expectedWord.trim().toLowerCase();

  function handleDialogOpenChange(next: boolean) {
    if (deleting && !next) return;
    onOpenChange(next);
  }

  async function handleConfirm() {
    if (!clientId || !matches || deleting) return;
    try {
      await deleteClient(clientId);
      toast.success(t("successToast"));
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("genericError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      {open && clientId ? (
      <StandardDialogContent
        size="default"
        showCloseButton={!deleting}
        title={t("title")}
        description={clientName}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={deleting}
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4 shrink-0" aria-hidden />
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="gap-2"
              disabled={!matches || deleting}
              onClick={() => void handleConfirm()}
            >
              {deleting ? (
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="size-4 shrink-0" aria-hidden />
              )}
              {deleting ? t("deleting") : t("confirm")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="size-4" aria-hidden />
            <AlertTitle className="text-sm font-medium">{t("alertTitle")}</AlertTitle>
            <AlertDescription className="text-sm">{t("description")}</AlertDescription>
          </Alert>
          <Field>
            <FieldLabel htmlFor="client-delete-confirm-input">
              {t("typeWordLabel", { word: expectedWord })}
            </FieldLabel>
            <Input
              id="client-delete-confirm-input"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              disabled={deleting}
              placeholder={expectedWord}
            />
          </Field>
        </div>
      </StandardDialogContent>
      ) : null}
    </Dialog>
  );
}
