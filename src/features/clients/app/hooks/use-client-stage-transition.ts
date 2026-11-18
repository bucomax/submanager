"use client";

import { useClientFileDownload } from "@/features/clients/app/hooks/use-client-file-download";
import { useClientPathwayActions } from "@/features/clients/app/hooks/use-client-pathway-actions";
import { TransitionBlockedByChecklistError } from "@/features/pathways/app/services/patient-pathways.service";
import { toast } from "@/lib/toast";
import type { ClientPatientPathwayDetailDto } from "@/types/api/clients-v1";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

const OVERRIDE_REASON_MIN_LENGTH = 10;

/** Fluxo "revisar → confirmar → transicionar etapa" da ficha do paciente. */
export function useClientStageTransition(pp: ClientPatientPathwayDetailDto | null | undefined) {
  const t = useTranslations("clients.detail");
  const tp = useTranslations("pathways.patient");
  const { transitioning: submitting, transitionClientStage } = useClientPathwayActions();
  const { downloadingId: stageDocDownloadingId, openDownload } = useClientFileDownload();

  const [toStageId, setToStageId] = useState("");
  const [note, setNote] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const nextOptions = useMemo(() => {
    if (!pp?.pathwayVersion?.stages?.length) return [];
    const cur = pp.currentStage?.id;
    return pp.pathwayVersion.stages.filter((s) => s.id !== cur);
  }, [pp]);

  const targetStageName = useMemo(
    () => nextOptions.find((s) => s.id === toStageId)?.name ?? "",
    [nextOptions, toStageId],
  );

  const targetStageDocuments = useMemo(() => {
    if (!pp || !toStageId) return [];
    return pp.pathwayVersion.stages.find((s) => s.id === toStageId)?.documents ?? [];
  }, [pp, toStageId]);

  const incompleteRequiredChecklist = (pp?.currentStage?.checklistItems ?? []).filter(
    (item) => item.requiredForTransition && !item.completed,
  );

  function openTransitionConfirm() {
    if (!pp || !toStageId) {
      toast.error(tp("toStagePlaceholder"));
      return;
    }
    if (toStageId === pp.currentStage?.id) {
      toast.error(tp("sameStage"));
      return;
    }
    setConfirmOpen(true);
  }

  function handleConfirmOpenChange(open: boolean) {
    if (submitting) return;
    setConfirmOpen(open);
    if (!open) setOverrideReason("");
  }

  async function executeTransition() {
    if (!pp || !toStageId) return;
    const needsForce = incompleteRequiredChecklist.length > 0;
    const trimmedOverride = overrideReason.trim();
    if (needsForce && trimmedOverride.length < OVERRIDE_REASON_MIN_LENGTH) {
      toast.error(t("transition.overrideReasonMin"));
      return;
    }
    try {
      await transitionClientStage(pp.id, {
        toStageId,
        note: note.trim() || undefined,
        ...(needsForce ? { force: true, overrideReason: trimmedOverride } : {}),
      });
      toast.success(tp("success"));
      setConfirmOpen(false);
      setToStageId("");
      setNote("");
      setOverrideReason("");
    } catch (e) {
      if (e instanceof TransitionBlockedByChecklistError) {
        toast.error(e.message);
        return;
      }
      /* erro: toast global no apiClient */
    }
  }

  async function openStageDocument(fileId: string) {
    try {
      await openDownload(fileId);
    } catch {
      toast.error(t("transition.openStageDocumentError"));
    }
  }

  return {
    toStageId,
    setToStageId,
    note,
    setNote,
    overrideReason,
    setOverrideReason,
    confirmOpen,
    setConfirmOpen,
    handleConfirmOpenChange,
    submitting,
    nextOptions,
    targetStageName,
    targetStageDocuments,
    incompleteRequiredChecklist,
    stageDocDownloadingId,
    openTransitionConfirm,
    executeTransition,
    openStageDocument,
  };
}
