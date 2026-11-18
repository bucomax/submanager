"use client";

import { useCallback, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { pathwayKeys } from "@/features/pathways/app/hooks/query-keys";
import {
  getPatientPathway,
  transitionPatientStage,
} from "@/features/pathways/app/services/patient-pathways.service";
import type { TransitionPatientStageInput } from "@/features/pathways/app/types/patient-pathways";
import { isQueryLoading } from "@/shared/utils/query-loading";

export function usePatientPathway(patientPathwayId: string) {
  const t = useTranslations("pathways.patient");
  const query = useQuery({
    queryKey: pathwayKeys.patientPathway(patientPathwayId),
    queryFn: ({ signal }) => getPatientPathway(patientPathwayId, { signal }),
  });
  const { refetch } = query;

  const transitionMutation = useMutation({
    mutationFn: (input: TransitionPatientStageInput) => transitionPatientStage(patientPathwayId, input),
    // Aguarda o refetch para o formulário só liberar com a etapa nova já carregada.
    onSuccess: () => refetch(),
  });
  const { mutateAsync } = transitionMutation;

  const reload = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const submitTransition = useCallback(
    async (input: TransitionPatientStageInput) => {
      await mutateAsync(input);
    },
    [mutateAsync],
  );

  const data = query.data ?? null;
  const nextOptions = useMemo(() => {
    if (!data?.pathwayVersion?.stages?.length) return [];
    const currentStageId = data.currentStage?.id;
    return data.pathwayVersion.stages.filter((stage) => stage.id !== currentStageId);
  }, [data]);

  return {
    data,
    loading: isQueryLoading(query),
    error: query.error ? query.error.message || t("loadError") : null,
    submitting: transitionMutation.isPending,
    reload,
    submitTransition,
    nextOptions,
  };
}
