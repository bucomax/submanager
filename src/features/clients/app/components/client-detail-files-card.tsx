"use client";

import { ClientDetailCardTitle } from "@/features/clients/app/components/client-detail-card-title";
import {
  ClientFileDeleteDialog,
  ClientFileRejectDialog,
  ClientFileRejectReasonDialog,
} from "@/features/clients/app/components/client-files-dialogs";
import { ClientFilesListItem } from "@/features/clients/app/components/client-files-list-item";
import { useClientFileDownload } from "@/features/clients/app/hooks/use-client-file-download";
import { useClientFileMutations } from "@/features/clients/app/hooks/use-client-file-mutations";
import { useClientFiles } from "@/features/clients/app/hooks/use-client-files";
import { toast } from "@/lib/toast";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { ChevronLeft, ChevronRight, FolderOpen, Info, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

type ClientDetailFilesCardProps = {
  clientId: string;
};

export function ClientDetailFilesCard({ clientId }: ClientDetailFilesCardProps) {
  const t = useTranslations("clients.detail.files");
  const { data, error, loading, page, setPage, reload, limit } = useClientFiles(clientId);
  const { downloadingId, openDownload } = useClientFileDownload();
  const { deletingId, reviewingId, deleteFile, reviewFile } = useClientFileMutations(clientId);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; fileName: string } | null>(null);
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
    try {
      await deleteFile(pendingDelete.id);
      toast.success(t("deleteSuccess"));
      setPendingDelete(null);
    } catch {
      /* erro: toast global no apiClient */
    }
  }

  function handleDeleteDialogOpenChange(open: boolean) {
    if (!open && deletingId === null) {
      setPendingDelete(null);
    }
  }

  async function handleApprove(fileId: string) {
    try {
      await reviewFile({ fileId, decision: "approve" });
      toast.success(t("reviewApproveSuccess"));
    } catch {
      /* toast global */
    }
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    try {
      await reviewFile({
        fileId: rejectTarget.id,
        decision: "reject",
        rejectReason: rejectReason.trim() || undefined,
      });
      toast.success(t("reviewRejectSuccess"));
      setRejectTarget(null);
      setRejectReason("");
    } catch {
      /* toast global */
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
              <ClientFilesListItem
                key={f.id}
                file={f}
                downloadingId={downloadingId}
                deletingId={deletingId}
                reviewingId={reviewingId}
                onApprove={(fileId) => void handleApprove(fileId)}
                onReject={(file) => setRejectTarget({ id: file.id, fileName: file.fileName })}
                onOpen={(fileId) => void handleOpenDownload(fileId)}
                onShowRejectReason={(file) =>
                  setRejectReasonInsight({
                    fileName: file.fileName,
                    reason: file.patientPortalRejectReason,
                  })
                }
                onDelete={(file) => setPendingDelete({ id: file.id, fileName: file.fileName })}
              />
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

      <ClientFileRejectDialog
        target={rejectTarget}
        reason={rejectReason}
        onReasonChange={setRejectReason}
        busy={reviewingId !== null}
        onOpenChange={handleRejectDialogOpenChange}
        onCancel={() => {
          setRejectTarget(null);
          setRejectReason("");
        }}
        onConfirm={() => void confirmReject()}
      />
      <ClientFileRejectReasonDialog
        insight={rejectReasonInsight}
        onClose={() => setRejectReasonInsight(null)}
      />
      <ClientFileDeleteDialog
        target={pendingDelete}
        busy={deletingId !== null}
        onOpenChange={handleDeleteDialogOpenChange}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </Card>
  );
}
