"use client";

import { patientPortalKeys } from "@/features/patient-portal/app/hooks/query-keys";
import {
  fetchPatientPortalTimeline,
  PatientPortalUnauthorizedError,
} from "@/lib/api/patient-portal-client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

const TIMELINE_LIMIT = 20;

/**
 * Timeline do portal do paciente. `sessionKey` (id do paciente da sessão) habilita a busca;
 * ações que geram eventos invalidam `patientPortalKeys.timelineAll`.
 */
export function usePatientPortalTimeline(tenantSlug: string, sessionKey: string | null) {
  const t = useTranslations("patientPortal");
  const [page, setPage] = useState(1);
  const enabled = sessionKey !== null;
  const query = useQuery({
    queryKey: patientPortalKeys.timeline(tenantSlug, page),
    queryFn: ({ signal }) => fetchPatientPortalTimeline(tenantSlug, page, TIMELINE_LIMIT, { signal }),
    enabled,
    // Mantém a página anterior visível enquanto a próxima carrega.
    placeholderData: keepPreviousData,
  });

  const unauthorized = query.error instanceof PatientPortalUnauthorizedError;

  return {
    timeline: enabled && !query.isError ? (query.data ?? null) : null,
    loading: enabled && query.isFetching,
    error: query.isError && !unauthorized ? t("timeline.loadError") : null,
    goToPage: setPage,
  };
}
