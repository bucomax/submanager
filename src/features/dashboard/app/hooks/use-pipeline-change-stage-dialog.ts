"use client";

import { clientKeys } from "@/features/clients/app/hooks/query-keys";
import { dashboardKeys } from "@/features/dashboard/app/hooks/query-keys";
import {
  completePatientPathway,
  getPatientPathway,
  TransitionBlockedByChecklistError,
  transitionPatientStage,
} from "@/features/pathways/app/services/patient-pathways.service";
import { toast } from "@/lib/toast";
import { getErrorMessage } from "@/lib/utils/error-message";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

type TransitionInput = {
  toStageId: string;
  note?: string;
  force?: boolean;
  overrideReason?: string;
};

export function usePipelineChangeStageDialog(patientPathwayId: string | null, open: boolean) {
  const t = useTranslations("dashboard.pipeline");
  const queryClient = useQueryClient();
  const enabled = open && Boolean(patientPathwayId);

  const query = useQuery({
    queryKey: dashboardKeys.changeStageDetail(patientPathwayId ?? ""),
    queryFn: ({ signal }) => getPatientPathway(patientPathwayId!, { signal }),
    enabled,
    // Checklist e etapa atual mudam fora do diálogo: toda abertura busca de novo.
    staleTime: 0,
  });
  const detail = enabled && !query.isFetching && !query.isError ? (query.data ?? null) : null;

  const nextOptions = useMemo(() => {
    if (!detail?.pathwayVersion?.stages?.length) return [];
    const currentStageId = detail.currentStage?.id;
    return detail.pathwayVersion.stages.filter((stage) => stage.id !== currentStageId);
  }, [detail]);

  const refreshClientData = () => {
    void queryClient.invalidateQueries({ queryKey: clientKeys.all });
  };

  const transition = useMutation({
    mutationFn: (input: TransitionInput) => transitionPatientStage(patientPathwayId!, input),
    onSuccess: refreshClientData,
  });
  const complete = useMutation({
    mutationFn: () => completePatientPathway(patientPathwayId!),
    onSuccess: refreshClientData,
  });

  /** `true` quando a transição foi feita; falhas já viram toast (checklist aqui, demais no apiClient). */
  async function submitChange(input: TransitionInput): Promise<boolean> {
    if (!patientPathwayId) return false;
    try {
      await transition.mutateAsync(input);
      return true;
    } catch (e) {
      if (e instanceof TransitionBlockedByChecklistError) toast.error(e.message);
      return false;
    }
  }

  /** `true` quando o tratamento foi concluído. */
  async function completeTreatment(): Promise<boolean> {
    if (!patientPathwayId) return false;
    try {
      await complete.mutateAsync();
      return true;
    } catch {
      return false;
    }
  }

  return {
    loading: enabled && query.isFetching,
    submitting: transition.isPending,
    completing: complete.isPending,
    error: enabled && query.isError ? getErrorMessage(query.error, t("modals.changeStage.loadError")) : null,
    detail,
    nextOptions,
    submitChange,
    completeTreatment,
  };
}
