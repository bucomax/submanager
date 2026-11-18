"use client";

import { displayFileBaseName } from "@/lib/utils/filename-display";
import { formatFileSize } from "@/lib/utils/format-bytes";
import { formatListUpdatedAt } from "@/lib/utils/format-list-updated-at";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import type { ClientFileListItemDto } from "@/types/api/files-v1";
import { Check, ExternalLink, Info, Loader2, ScrollText, Trash2, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

type ClientFilesListItemProps = {
  file: ClientFileListItemDto;
  downloadingId: string | null;
  deletingId: string | null;
  reviewingId: string | null;
  onApprove: (fileId: string) => void;
  onReject: (file: ClientFileListItemDto) => void;
  onOpen: (fileId: string) => void;
  onShowRejectReason: (file: ClientFileListItemDto) => void;
  onDelete: (file: ClientFileListItemDto) => void;
};

export function ClientFilesListItem({
  file: f,
  downloadingId,
  deletingId,
  reviewingId,
  onApprove,
  onReject,
  onOpen,
  onShowRejectReason,
  onDelete,
}: ClientFilesListItemProps) {
  const t = useTranslations("clients.detail.files");
  const locale = useLocale();

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-xl border px-3.5 py-3 shadow-sm backdrop-blur-sm transition-colors sm:flex-row sm:items-start sm:justify-between",
        f.patientPortalReviewStatus === "REJECTED"
          ? "border-destructive/45 bg-destructive/[0.06] hover:border-destructive/60 hover:bg-destructive/[0.09] dark:border-destructive/50 dark:bg-destructive/15 dark:hover:bg-destructive/20"
          : "border-border/80 bg-card/50 hover:border-primary/20 hover:bg-muted/25",
      )}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-foreground truncate text-sm font-semibold leading-tight">
          {displayFileBaseName(f.fileName)}
        </p>
        <p className="text-muted-foreground text-xs tabular-nums">
          {formatFileSize(f.sizeBytes)} · {formatListUpdatedAt(f.createdAt, locale)}
        </p>
        <p className="text-muted-foreground text-xs">
          {f.uploadedBy
            ? t("uploadedBy", { name: f.uploadedBy.name ?? f.uploadedBy.email })
            : t("uploadedByPortal")}
        </p>
        {f.patientPortalReviewStatus === "PENDING" ? (
          <Alert variant="info" className="border-border/60 bg-muted/25">
            <Info className="size-4 shrink-0" aria-hidden />
            <AlertDescription className="text-muted-foreground text-sm leading-snug">
              {t("statusPending")}
            </AlertDescription>
          </Alert>
        ) : null}
        {f.patientPortalReviewStatus === "REJECTED" ? (
          <Alert
            variant="destructive"
            className="border-destructive/40 bg-destructive/10 dark:bg-destructive/20"
          >
            <XCircle className="size-4 shrink-0" aria-hidden />
            <AlertDescription className="text-destructive text-sm font-medium leading-snug">
              {t("statusRejected")}
            </AlertDescription>
          </Alert>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
        {f.patientPortalReviewStatus === "PENDING" ? (
          <>
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="inline-flex">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="border-success/35 text-success hover:bg-success/10 hover:text-success"
                      disabled={reviewingId !== null || deletingId !== null || downloadingId === f.id}
                      aria-label={t("approve")}
                      onClick={() => onApprove(f.id)}
                    >
                      {reviewingId === f.id ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <Check className="size-4" aria-hidden />
                      )}
                    </Button>
                  </span>
                }
              />
              <TooltipContent side="top">{t("approve")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="inline-flex">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="border-warning/40 text-warning hover:bg-warning/10"
                      disabled={reviewingId !== null || deletingId !== null || downloadingId === f.id}
                      aria-label={t("reject")}
                      onClick={() => onReject(f)}
                    >
                      <XCircle className="size-4" aria-hidden />
                    </Button>
                  </span>
                }
              />
              <TooltipContent side="top">{t("reject")}</TooltipContent>
            </Tooltip>
          </>
        ) : null}
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="inline-flex">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  disabled={downloadingId === f.id || deletingId === f.id}
                  aria-label={t("openAria")}
                  onClick={() => onOpen(f.id)}
                >
                  {downloadingId === f.id ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <ExternalLink className="size-4" aria-hidden />
                  )}
                </Button>
              </span>
            }
          />
          <TooltipContent side="top">{t("openAria")}</TooltipContent>
        </Tooltip>
        {f.patientPortalReviewStatus === "REJECTED" ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="inline-flex">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="border-destructive/40 text-destructive hover:bg-destructive/15 dark:hover:bg-destructive/25"
                    disabled={downloadingId === f.id || deletingId === f.id}
                    aria-label={t("rejectReasonTooltip")}
                    onClick={() => onShowRejectReason(f)}
                  >
                    <ScrollText className="size-4" aria-hidden />
                  </Button>
                </span>
              }
            />
            <TooltipContent side="top">{t("rejectReasonTooltip")}</TooltipContent>
          </Tooltip>
        ) : null}
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="inline-flex">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="border-destructive/45 text-destructive hover:border-destructive hover:bg-destructive/10 hover:text-destructive dark:border-destructive/55"
                  disabled={deletingId === f.id || downloadingId === f.id}
                  aria-label={t("deleteAria")}
                  onClick={() => onDelete(f)}
                >
                  {deletingId === f.id ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="size-4" aria-hidden />
                  )}
                </Button>
              </span>
            }
          />
          <TooltipContent side="top">{t("deleteAria")}</TooltipContent>
        </Tooltip>
      </div>
    </li>
  );
}
