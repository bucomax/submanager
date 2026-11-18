"use client";

import { displayFileBaseName } from "@/lib/utils/filename-display";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { Dialog, StandardDialogContent } from "@/shared/components/ui/dialog";
import { Loader2, Trash2, X, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";

type FileTarget = { id: string; fileName: string };

type ClientFileRejectDialogProps = {
  target: FileTarget | null;
  reason: string;
  onReasonChange: (value: string) => void;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ClientFileRejectDialog({
  target,
  reason,
  onReasonChange,
  busy,
  onOpenChange,
  onCancel,
  onConfirm,
}: ClientFileRejectDialogProps) {
  const t = useTranslations("clients.detail.files");
  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <StandardDialogContent
        size="sm"
        showCloseButton={!busy}
        title={t("rejectDialogTitle")}
        description={target ? t("rejectDialogDescription", { fileName: target.fileName }) : undefined}
        footer={
          <>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onCancel}>
              <X className="size-4 shrink-0" aria-hidden />
              {t("deleteConfirmCancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="gap-1.5"
              disabled={busy}
              onClick={onConfirm}
            >
              {busy ? (
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <XCircle className="size-4 shrink-0" aria-hidden />
              )}
              {t("rejectConfirm")}
            </Button>
          </>
        }
      >
        <textarea
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder={t("rejectReasonPlaceholder")}
          rows={3}
          disabled={busy}
          className={cn(
            "border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex w-full resize-none rounded-lg border px-2.5 py-2 text-sm transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
          )}
        />
      </StandardDialogContent>
    </Dialog>
  );
}

type ClientFileRejectReasonDialogProps = {
  insight: { fileName: string; reason: string | null } | null;
  onClose: () => void;
};

export function ClientFileRejectReasonDialog({ insight, onClose }: ClientFileRejectReasonDialogProps) {
  const t = useTranslations("clients.detail.files");
  return (
    <Dialog
      open={insight !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <StandardDialogContent
        size="sm"
        title={t("rejectReasonDialogTitle")}
        description={
          insight
            ? t("rejectReasonDialogDescription", { fileName: displayFileBaseName(insight.fileName) })
            : undefined
        }
        footer={
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t("rejectReasonClose")}
          </Button>
        }
      >
        <p className="text-foreground text-sm whitespace-pre-wrap">
          {insight?.reason && insight.reason.trim() !== "" ? insight.reason : t("rejectReasonEmpty")}
        </p>
      </StandardDialogContent>
    </Dialog>
  );
}

type ClientFileDeleteDialogProps = {
  target: FileTarget | null;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ClientFileDeleteDialog({
  target,
  busy,
  onOpenChange,
  onCancel,
  onConfirm,
}: ClientFileDeleteDialogProps) {
  const t = useTranslations("clients.detail.files");
  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <StandardDialogContent
        size="sm"
        showCloseButton={!busy}
        title={t("deleteConfirmTitle")}
        description={target ? t("deleteConfirmDescription", { fileName: target.fileName }) : undefined}
        bodyClassName="!max-h-0 !min-h-0 !flex-none !overflow-hidden !p-0"
        footer={
          <>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onCancel}>
              <X className="size-4 shrink-0" aria-hidden />
              {t("deleteConfirmCancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="gap-1.5"
              disabled={busy}
              onClick={onConfirm}
            >
              {busy ? (
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="size-4 shrink-0" aria-hidden />
              )}
              {t("deleteConfirmSubmit")}
            </Button>
          </>
        }
      >
        <div aria-hidden className="h-0" />
      </StandardDialogContent>
    </Dialog>
  );
}
