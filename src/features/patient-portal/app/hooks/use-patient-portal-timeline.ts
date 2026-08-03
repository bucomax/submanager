"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import {
  fetchPatientPortalTimeline,
  PatientPortalUnauthorizedError,
} from "@/lib/api/patient-portal-client";
import type { PatientPortalTimelineResponseData } from "@/types/api/patient-portal-v1";

const TIMELINE_LIMIT = 20;

type TimelineRequestState = {
  /** Sinal de refresh que originou a página atual — trocou, volta para a página 1. */
  refreshSignal: number;
  page: number;
  /** Incrementa a cada pedido explícito, para refazer a busca mesmo na mesma página. */
  tick: number;
};

type TimelineResult = {
  requestKey: string;
  data: PatientPortalTimelineResponseData | null;
  error: string | null;
};

/**
 * Timeline do portal do paciente.
 *
 * Cada busca tem uma `requestKey` (sessão + refresh + página + pedido) e o resultado
 * guarda a chave que o originou. `loading` sai da comparação entre a chave pedida e a
 * chave já respondida, o que evita `setState` síncrono dentro do efeito.
 */
export function usePatientPortalTimeline(
  tenantSlug: string,
  sessionKey: string | null,
  refreshSignal: number,
) {
  const t = useTranslations("patientPortal");
  const [requestState, setRequestState] = useState<TimelineRequestState>({
    refreshSignal,
    page: 1,
    tick: 0,
  });
  const [result, setResult] = useState<TimelineResult | null>(null);

  const current: TimelineRequestState =
    requestState.refreshSignal === refreshSignal ? requestState : { refreshSignal, page: 1, tick: 0 };

  const page = current.page;
  const requestKey =
    sessionKey === null ? null : `${tenantSlug}|${sessionKey}|${refreshSignal}|${page}|${current.tick}`;
  const settled = result !== null && result.requestKey === requestKey ? result : null;

  useEffect(() => {
    if (requestKey === null) return;
    let cancelled = false;
    void fetchPatientPortalTimeline(tenantSlug, page, TIMELINE_LIMIT)
      .then((rows) => {
        if (!cancelled) setResult({ requestKey, data: rows, error: null });
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof PatientPortalUnauthorizedError) {
          setResult({ requestKey, data: null, error: null });
          return;
        }
        setResult({ requestKey, data: null, error: t("timeline.loadError") });
      });
    return () => {
      cancelled = true;
    };
  }, [page, requestKey, t, tenantSlug]);

  const goToPage = useCallback(
    (next: number) => {
      setRequestState((prev) => {
        const base = prev.refreshSignal === refreshSignal ? prev : { refreshSignal, page: 1, tick: 0 };
        return { refreshSignal, page: next, tick: base.tick + 1 };
      });
    },
    [refreshSignal],
  );

  return {
    /** Mantém a página anterior visível enquanto a próxima carrega. */
    timeline: requestKey === null ? null : (settled?.data ?? result?.data ?? null),
    loading: requestKey !== null && settled === null,
    error: settled?.error ?? null,
    goToPage,
  };
}
