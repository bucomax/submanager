"use client";

import { patientPortalKeys } from "@/features/patient-portal/app/hooks/query-keys";
import {
  fetchPatientPortalFiles,
  PatientPortalUnauthorizedError,
  requestPatientPortalFileDownloadPresign,
  uploadPatientPortalFile,
} from "@/lib/api/patient-portal-client";
import { getErrorMessage } from "@/lib/utils/error-message";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

const FILES_LIMIT = 20;

type UploadState = { name: string; progress: number };

/** Lista paginada, upload (com progresso) e download de arquivos do paciente no portal. */
export function usePatientPortalFiles(tenantSlug: string, onAfterUpload?: () => void) {
  const t = useTranslations("patientPortal");
  const queryClient = useQueryClient();
  const [page, setPageState] = useState(1);
  const [actionError, setActionError] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState | null>(null);

  const query = useQuery({
    queryKey: patientPortalKeys.files(tenantSlug, page),
    queryFn: ({ signal }) => fetchPatientPortalFiles(tenantSlug, page, FILES_LIMIT, { signal }),
    placeholderData: keepPreviousData,
  });

  const upload = useMutation({
    mutationFn: (file: File) =>
      uploadPatientPortalFile(tenantSlug, file, (progress) => {
        setUploadState((s) => (s ? { ...s, progress } : null));
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: patientPortalKeys.filesAll(tenantSlug) });
      void queryClient.invalidateQueries({ queryKey: patientPortalKeys.timelineAll(tenantSlug) });
    },
  });

  const download = useMutation({
    mutationFn: async (fileId: string) => {
      const url = await requestPatientPortalFileDownloadPresign(tenantSlug, fileId);
      window.open(url, "_blank", "noopener,noreferrer");
    },
  });

  function goToPage(next: number) {
    setActionError(null);
    setPageState(next);
  }

  async function uploadFile(file: File) {
    setUploadState({ name: file.name, progress: 0 });
    setActionError(null);
    try {
      await upload.mutateAsync(file);
      onAfterUpload?.();
    } catch (err: unknown) {
      if (err instanceof PatientPortalUnauthorizedError) return;
      setActionError(getErrorMessage(err, t("files.uploadError")));
    } finally {
      setUploadState(null);
    }
  }

  async function openDownload(fileId: string) {
    try {
      await download.mutateAsync(fileId);
    } catch {
      setActionError(t("files.downloadError"));
    }
  }

  const loadFailed = query.isError && !(query.error instanceof PatientPortalUnauthorizedError);

  return {
    data: query.isError ? null : (query.data ?? null),
    loading: query.isFetching,
    error: actionError ?? (loadFailed ? t("files.loadError") : null),
    page,
    limit: FILES_LIMIT,
    goToPage,
    uploadState,
    uploadFile,
    downloadId: download.isPending ? download.variables : null,
    openDownload,
  };
}
