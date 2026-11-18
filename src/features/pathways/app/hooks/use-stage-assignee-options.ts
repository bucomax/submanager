"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useTenantMemberPicker } from "@/features/settings/app/hooks/use-tenant-member-picker";
import { PATHWAY_STAGE_NONE_ASSIGNEE } from "@/features/pathways/app/utils/stage-default-assignee";
import type { LabeledSelectOption } from "@/shared/components/forms/labeled-select";

/** Opções do select de responsável padrão por etapa: "nenhum" + membros do tenant (falha = só "nenhum"). */
export function useStageAssigneeOptions(): { options: LabeledSelectOption[]; noneLabel: string } {
  const t = useTranslations("pathways.editor");
  const noneLabel = t("defaultAssigneeNone");
  const { members } = useTenantMemberPicker();

  const options = useMemo(
    () => [
      { value: PATHWAY_STAGE_NONE_ASSIGNEE, label: noneLabel },
      ...members.map((m) => ({
        value: m.userId,
        label: m.name?.trim() ? `${m.name} (${m.email})` : m.email,
      })),
    ],
    [members, noneLabel],
  );

  return { options, noneLabel };
}
