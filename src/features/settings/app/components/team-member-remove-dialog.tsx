"use client";

import type { TenantMemberRow } from "@/features/settings/app/types/account";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Dialog, StandardDialogContent } from "@/shared/components/ui/dialog";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

type TeamMemberRemoveDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TenantMemberRow | null;
  busy: boolean;
  onConfirm: () => Promise<void>;
};

export function TeamMemberRemoveDialog({
  open,
  onOpenChange,
  member,
  busy,
  onConfirm,
}: TeamMemberRemoveDialogProps) {
  const t = useTranslations("settings.members");
  const [pending, setPending] = useState(false);

  const displayName = member?.name?.trim() || member?.email || "";

  function handleOpenChange(next: boolean) {
    if ((pending || busy) && !next) return;
    onOpenChange(next);
  }

  async function handleConfirm() {
    if (!member || pending || busy) return;
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  }

  const locked = pending || busy;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {open && member ? (
        <StandardDialogContent
          size="sm"
          showCloseButton={!locked}
          title={t("removeDialogTitle")}
          description={t("removeDialogDescription", { name: displayName })}
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5"
                disabled={locked}
                onClick={() => onOpenChange(false)}
              >
                <X className="size-4 shrink-0" aria-hidden />
                {t("removeDialogCancel")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="gap-2"
                disabled={locked}
                onClick={() => void handleConfirm()}
              >
                {locked ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="size-4 shrink-0" aria-hidden />
                )}
                {locked ? t("removeDialogRemoving") : t("removeDialogConfirm")}
              </Button>
            </>
          }
        >
          <Alert variant="destructive">
            <AlertTriangle className="size-4" aria-hidden />
            <AlertTitle className="text-sm font-medium">{t("removeDialogAlertTitle")}</AlertTitle>
            <AlertDescription className="text-sm">{t("removeDialogAlertBody")}</AlertDescription>
          </Alert>
        </StandardDialogContent>
      ) : null}
    </Dialog>
  );
}
