"use client";

import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { requestFileDownloadPresign } from "@/features/clients/app/services/clients.service";
import { uploadTenantLibraryFile } from "@/features/pathways/app/services/pathway-tenant-file-upload.service";
import { toast } from "@/lib/toast";

export type PendingStageDocumentRow = {
  tempId: string;
  fileName: string;
  progress: number;
};

type AddedDocument = { fileAssetId: string; fileName: string; mimeType: string };

/** Upload (com progresso por arquivo) e abertura de documentos anexados a uma etapa. */
export function useStageDocuments({
  onDocumentsAdded,
}: {
  onDocumentsAdded: (items: AddedDocument[]) => void;
}) {
  const t = useTranslations("pathways.editor");
  const [pendingRows, setPendingRows] = useState<PendingStageDocumentRow[]>([]);

  const uploadMutation = useMutation({
    mutationFn: ({ file, onProgress }: { file: File; onProgress: (pct: number) => void }) =>
      uploadTenantLibraryFile(file, onProgress),
  });
  const { mutateAsync: uploadAsync } = uploadMutation;

  const openMutation = useMutation({
    mutationFn: (fileAssetId: string) => requestFileDownloadPresign({ fileId: fileAssetId }),
    onSuccess: ({ downloadUrl }) => window.open(downloadUrl, "_blank", "noopener,noreferrer"),
  });
  const { mutateAsync: openAsync } = openMutation;

  const updatePendingProgress = useCallback((tempId: string, progress: number) => {
    setPendingRows((rows) => rows.map((r) => (r.tempId === tempId ? { ...r, progress } : r)));
  }, []);

  const openFile = useCallback(
    async (fileAssetId: string) => {
      try {
        await openAsync(fileAssetId);
      } catch {
        /* erro: toast global no apiClient */
      }
    },
    [openAsync],
  );

  const uploadFiles = useCallback(
    async (list: FileList | null) => {
      if (!list?.length) return;
      const queued = Array.from(list).map((file) => ({ tempId: crypto.randomUUID(), file }));
      setPendingRows((rows) => [
        ...rows,
        ...queued.map((q) => ({ tempId: q.tempId, fileName: q.file.name, progress: 0 })),
      ]);

      let successCount = 0;
      await Promise.all(
        queued.map(async ({ tempId, file }) => {
          try {
            const f = await uploadAsync({ file, onProgress: (pct) => updatePendingProgress(tempId, pct) });
            onDocumentsAdded([{ fileAssetId: f.id, fileName: f.fileName, mimeType: f.mimeType }]);
            successCount += 1;
          } catch (e) {
            toast.error(e instanceof Error ? e.message : t("stageDocumentsUploadError"));
          } finally {
            setPendingRows((rows) => rows.filter((r) => r.tempId !== tempId));
          }
        }),
      );

      if (successCount > 0) {
        toast.success(t("stageDocumentsUploadSuccess", { count: successCount }));
      }
    },
    [onDocumentsAdded, t, uploadAsync, updatePendingProgress],
  );

  return {
    pendingRows,
    openingId: openMutation.isPending ? openMutation.variables : null,
    openFile,
    uploadFiles,
  };
}
