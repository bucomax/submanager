"use client";

import { clientKeys } from "@/features/clients/app/hooks/query-keys";
import { dashboardKeys } from "@/features/dashboard/app/hooks/query-keys";
import type { PipelineData, PipelineQueryFilters } from "@/features/dashboard/app/hooks/use-pipeline-data";
import { getKanbanColumnPatients } from "@/features/dashboard/app/services/dashboard-pipeline.service";
import type { KanbanColumn } from "@/features/dashboard/app/types";
import { moveKanbanPatient } from "@/features/dashboard/app/utils/kanban-optimistic-move";
import { transitionPatientStage } from "@/features/pathways/app/services/patient-pathways.service";
import { toast } from "@/lib/toast";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

type UsePipelineKanbanActionsParams = PipelineQueryFilters & {
  queryKey: QueryKey;
  columns: KanbanColumn[];
};

type LoadMoreVariables = { stageId: string; page: number; limit: number };
type MoveVariables = { patientPathwayId: string; toStageId: string; optimisticColumns: KanbanColumn[] };

/** "Carregar mais" por coluna e arrastar paciente entre etapas (com update otimista e rollback). */
export function usePipelineKanbanActions({
  queryKey,
  columns,
  pathwayId,
  debouncedSearch,
  statusFilter,
  opmeSupplierId,
}: UsePipelineKanbanActionsParams) {
  const t = useTranslations("dashboard.pipeline");
  const queryClient = useQueryClient();
  const setColumns = (update: (current: KanbanColumn[]) => KanbanColumn[]) =>
    queryClient.setQueryData<PipelineData>(queryKey, (old) =>
      old ? { ...old, columns: update(old.columns) } : old,
    );

  const loadMore = useMutation({
    mutationFn: ({ stageId, page, limit }: LoadMoreVariables) =>
      getKanbanColumnPatients(pathwayId, stageId, {
        search: debouncedSearch || undefined,
        limit,
        page,
        opmeSupplierId: opmeSupplierId || undefined,
      }),
    onSuccess: ({ data, pagination }, { stageId }) => {
      setColumns((current) =>
        current.map((c) =>
          c.stage.id === stageId ? { ...c, data: [...c.data, ...data], pagination } : c,
        ),
      );
    },
  });

  const move = useMutation({
    mutationFn: ({ patientPathwayId, toStageId }: MoveVariables) =>
      transitionPatientStage(patientPathwayId, { toStageId }),
    onMutate: async ({ optimisticColumns }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<PipelineData>(queryKey);
      setColumns(() => optimisticColumns);
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSuccess: () => {
      toast.success(t("drag.transitionSuccess"));
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: dashboardKeys.pipelineAll }),
        queryClient.invalidateQueries({ queryKey: clientKeys.all }),
      ]);
    },
  });

  async function loadMoreColumn(stageId: string) {
    if (!pathwayId) return;
    const col = columns.find((c) => c.stage.id === stageId);
    if (!col?.pagination.hasNextPage) return;
    try {
      await loadMore.mutateAsync({
        stageId,
        page: col.pagination.page + 1,
        limit: col.pagination.limit,
      });
    } catch {
      /* erro: toast global no apiClient */
    }
  }

  async function movePatientToStage(patientPathwayId: string, toStageId: string) {
    if (statusFilter) {
      toast.error(t("drag.disabledWithStatus"));
      return;
    }
    const optimisticColumns = moveKanbanPatient(columns, patientPathwayId, toStageId, new Date());
    if (!optimisticColumns) return;
    try {
      await move.mutateAsync({ patientPathwayId, toStageId, optimisticColumns });
    } catch {
      /* erro: rollback em onError + toast global no apiClient */
    }
  }

  return {
    loadingMoreStageId: loadMore.isPending ? loadMore.variables.stageId : null,
    transitioningPatientPathwayId: move.isPending ? move.variables.patientPathwayId : null,
    loadMoreColumn,
    movePatientToStage,
  };
}
