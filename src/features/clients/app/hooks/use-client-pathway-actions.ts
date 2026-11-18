"use client";

import { useInvalidateClientData } from "@/features/clients/app/hooks/use-invalidate-client-data";
import {
  togglePatientChecklistItem,
  transitionPatientStage,
} from "@/features/pathways/app/services/patient-pathways.service";
import { useMutation } from "@tanstack/react-query";

type TransitionInput = { toStageId: string; note?: string; force?: boolean; overrideReason?: string };

type TransitionVariables = { patientPathwayId: string; input: TransitionInput };
type ToggleChecklistVariables = {
  patientPathwayId: string;
  checklistItemId: string;
  completed: boolean;
};

export function useClientPathwayActions() {
  const invalidateClientData = useInvalidateClientData();

  const transition = useMutation({
    mutationFn: ({ patientPathwayId, input }: TransitionVariables) =>
      transitionPatientStage(patientPathwayId, input),
    onSuccess: () => {
      void invalidateClientData();
    },
  });

  const checklist = useMutation({
    mutationFn: ({ patientPathwayId, checklistItemId, completed }: ToggleChecklistVariables) =>
      togglePatientChecklistItem(patientPathwayId, checklistItemId, { completed }),
    onSuccess: () => {
      void invalidateClientData();
    },
  });

  return {
    transitioning: transition.isPending,
    updatingChecklistItemId: checklist.isPending ? checklist.variables.checklistItemId : null,
    transitionClientStage: async (patientPathwayId: string, input: TransitionInput) => {
      await transition.mutateAsync({ patientPathwayId, input });
    },
    toggleChecklistItem: async (
      patientPathwayId: string,
      checklistItemId: string,
      completed: boolean,
    ) => {
      await checklist.mutateAsync({ patientPathwayId, checklistItemId, completed });
    },
  };
}
