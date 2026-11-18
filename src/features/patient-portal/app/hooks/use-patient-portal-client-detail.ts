"use client";

import { patientPortalKeys } from "@/features/patient-portal/app/hooks/query-keys";
import {
  fetchPatientPortalDetail,
  PatientPortalUnauthorizedError,
} from "@/lib/api/patient-portal-client";
import { getErrorMessage } from "@/lib/utils/error-message";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

const TRANSITIONS_LIMIT = 20;

export function usePatientPortalClientDetail(tenantSlug: string) {
  const t = useTranslations("clients.detail");
  const query = useQuery({
    queryKey: patientPortalKeys.detail(tenantSlug),
    queryFn: ({ signal }) =>
      fetchPatientPortalDetail(tenantSlug, 1, TRANSITIONS_LIMIT, { signal }),
  });

  /** Cookie do portal ausente/expirado: a UI deve mostrar o login, não um erro. */
  const needsLink = query.error instanceof PatientPortalUnauthorizedError;

  return {
    data: query.isError ? null : (query.data ?? null),
    error: query.isError && !needsLink ? getErrorMessage(query.error, t("loadError")) : null,
    loading: query.isFetching,
    needsLink,
    reload: () => void query.refetch(),
    transitionsLimit: TRANSITIONS_LIMIT,
  };
}
