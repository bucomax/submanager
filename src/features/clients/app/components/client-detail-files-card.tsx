"use client";

import { ClientDetailCardTitle } from "@/features/clients/app/components/client-detail-card-title";
import { useClientFileDownload } from "@/features/clients/app/hooks/use-client-file-download";
import { useClientFiles } from "@/features/clients/app/hooks/use-client-files";
import { deleteClientFile, reviewPatientPortalClientFile } from "@/features/clients/app/services/clients.service";
import { toast } from "@/lib/toast";
import { displayFileBaseName } from "@/lib/utils/filename-display";
import { formatFileSize } from "@/lib/utils/format-bytes";
import { formatListUpdatedAt } from "@/lib/utils/format-list-updated-at";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/shared/components/ui/card";
import { Dialog, StandardDialogContent } from "@/shared/components/ui/dialog";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FolderOpen,
  Info,
  Loader2,
  RefreshCw,
  ScrollText,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useState } from "react";

type ClientDetailFilesCardProps = {
  clientId: string;
  /** Chamado após mutação na lista (ex.: exclusão) para sincronizar outras seções da ficha. */
  onFilesMutated?: () => void;
};

export function ClientDetailFilesCard({ clientId, onFilesMutated }: ClientDetailFilesCardProps) {
  const t = useTranslations("clients.detail.files");
  const locale = useLocale();
  const { data, error, loading, page, setPage, reload, limit } = useClientFiles(clientId);
  const { downloadingId, openDownload } = useClientFileDownload();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; fileName: string } | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; fileName: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectReasonInsight, setRejectReasonInsight] = useState<{
    fileName: string;
    reason: string | null;
  } | null>(null);

  async function handleOpenDownload(fileId: string) {
    try {
      await openDownload(fileId);
    } catch {
      /* erro: toast global no apiClient */
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const fileId = pendingDelete.id;
    setDeletingId(fileId);
    try {
      await deleteClientFile(clientId, fileId);
      toast.success(t("deleteSuccess"));
      setPendingDelete(null);
      reload();
      onFilesMutated?.();
    } catch {
      /* erro: toast global no apiClient */
    } finally {
      setDeletingId(null);
    }
  }

  function handleDeleteDialogOpenChange(open: boolean) {
    if (!open && deletingId === null) {
      setPendingDelete(null);
    }
  }

  async function handleApprove(fileId: string) {
    setReviewingId(fileId);
    try {
      await reviewPatientPortalClientFile(clientId, fileId, { decision: "approve" });
      toast.success(t("reviewApproveSuccess"));
      reload();
      onFilesMutated?.();
    } catch {
      /* toast global */
    } finally {
      setReviewingId(null);
    }
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    setReviewingId(rejectTarget.id);
    try {
      await reviewPatientPortalClientFile(clientId, rejectTarget.id, {
        decision: "reject",
        rejectReason: rejectReason.trim() || undefined,
      });
      toast.success(t("reviewRejectSuccess"));
      setRejectTarget(null);
      setRejectReason("");
      reload();
      onFilesMutated?.();
    } catch {
      /* toast global */
    } finally {
      setReviewingId(null);
    }
  }

  function handleRejectDialogOpenChange(open: boolean) {
    if (!open && reviewingId === null) {
      setRejectTarget(null);
      setRejectReason("");
    }
  }

  if (loading && !data) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full max-w-md" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <ClientDetailCardTitle icon={FolderOpen}>{t("title")}</ClientDetailCardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-destructive text-sm">{error ?? t("loadError")}</p>
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="inline-flex">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={t("retry")}
                    onClick={() => void reload()}
                  >
                    <RefreshCw className="size-4" aria-hidden />
                  </Button>
                </span>
              }
            />
            <TooltipContent side="top">{t("retry")}</TooltipContent>
          </Tooltip>
        </CardContent>
      </Card>
    );
  }

  const pag = data.pagination;
  const from = pag.totalItems === 0 ? 0 : (page - 1) * limit + 1;
  const to = pag.totalItems === 0 ? 0 : Math.min(page * limit, pag.totalItems);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <ClientDetailCardTitle icon={FolderOpen}>{t("title")}</ClientDetailCardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.data.length === 0 ? (
          <Alert variant="info" className="border-border/60 bg-muted/25">
            <Info className="size-4 shrink-0" aria-hidden />
            <AlertDescription className="text-muted-foreground text-sm leading-snug">{t("empty")}</AlertDescription>
          </Alert>
        ) : (
          <ul className="space-y-2.5">
            {data.data.map((f) => (
              <li
                key={f.id}
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
                                className="border-emerald-500/35 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                                disabled={reviewingId !== null || deletingId !== null || downloadingId === f.id}
                                aria-label={t("approve")}
                                onClick={() => void handleApprove(f.id)}
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
                                className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-500"
                                disabled={reviewingId !== null || deletingId !== null || downloadingId === f.id}
                                aria-label={t("reject")}
                                onClick={() => setRejectTarget({ id: f.id, fileName: f.fileName })}
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
                            onClick={() => void handleOpenDownload(f.id)}
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
                              onClick={() =>
                                setRejectReasonInsight({
                                  fileName: f.fileName,
                                  reason: f.patientPortalRejectReason,
                                })
                              }
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
                            onClick={() => setPendingDelete({ id: f.id, fileName: f.fileName })}
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
            ))}
          </ul>
        )}
        {pag.totalItems > 0 ? (
          <p className="text-muted-foreground text-xs">
            {t("range", { from, to, total: pag.totalItems })}
          </p>
        ) : null}
        {pag.totalPages > 1 ? (
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="inline-flex">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      disabled={!pag.hasPreviousPage}
                      aria-label={t("prev")}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="size-4" aria-hidden />
                    </Button>
                  </span>
                }
              />
              <TooltipContent side="top">{t("prev")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="inline-flex">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      disabled={!pag.hasNextPage}
                      aria-label={t("next")}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="size-4" aria-hidden />
                    </Button>
                  </span>
                }
              />
              <TooltipContent side="top">{t("next")}</TooltipContent>
            </Tooltip>
          </div>
        ) : null}
      </CardContent>

      <Dialog open={rejectTarget !== null} onOpenChange={handleRejectDialogOpenChange}>
        <StandardDialogContent
          size="sm"
          showCloseButton={reviewingId === null}
          title={t("rejectDialogTitle")}
          description={rejectTarget ? t("rejectDialogDescription", { fileName: rejectTarget.fileName }) : undefined}
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={reviewingId !== null}
                onClick={() => {
                  setRejectTarget(null);
                  setRejectReason("");
                }}
              >
                <X className="size-4 shrink-0" aria-hidden />
                {t("deleteConfirmCancel")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="gap-1.5"
                disabled={reviewingId !== null}
                onClick={() => void confirmReject()}
              >
                {reviewingId !== null ? (
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
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={t("rejectReasonPlaceholder")}
            rows={3}
            disabled={reviewingId !== null}
            className={cn(
              "border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex w-full resize-none rounded-lg border px-2.5 py-2 text-sm transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
            )}
          />
        </StandardDialogContent>
      </Dialog>

      <Dialog
        open={rejectReasonInsight !== null}
        onOpenChange={(open) => {
          if (!open) setRejectReasonInsight(null);
        }}
      >
        <StandardDialogContent
          size="sm"
          title={t("rejectReasonDialogTitle")}
          description={
            rejectReasonInsight
              ? t("rejectReasonDialogDescription", {
                  fileName: displayFileBaseName(rejectReasonInsight.fileName),
                })
              : undefined
          }
          footer={
            <Button type="button" variant="outline" size="sm" onClick={() => setRejectReasonInsight(null)}>
              {t("rejectReasonClose")}
            </Button>
          }
        >
          <p className="text-foreground text-sm whitespace-pre-wrap">
            {rejectReasonInsight?.reason && rejectReasonInsight.reason.trim() !== ""
              ? rejectReasonInsight.reason
              : t("rejectReasonEmpty")}
          </p>
        </StandardDialogContent>
      </Dialog>

      <Dialog open={pendingDelete !== null} onOpenChange={handleDeleteDialogOpenChange}>
        <StandardDialogContent
          size="sm"
          showCloseButton={deletingId === null}
          title={t("deleteConfirmTitle")}
          description={
            pendingDelete ? t("deleteConfirmDescription", { fileName: pendingDelete.fileName }) : undefined
          }
          bodyClassName="!max-h-0 !min-h-0 !flex-none !overflow-hidden !p-0"
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={deletingId !== null}
                onClick={() => setPendingDelete(null)}
              >
                <X className="size-4 shrink-0" aria-hidden />
                {t("deleteConfirmCancel")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="gap-1.5"
                disabled={deletingId !== null}
                onClick={() => void confirmDelete()}
              >
                {deletingId !== null ? (
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
    </Card>
  );
}
