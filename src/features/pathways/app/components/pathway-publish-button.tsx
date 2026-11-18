"use client";

import { Loader2, Rocket } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/shared/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import type { PathwayPublishPreviewDto } from "@/types/api/pathways-v1";

type PathwayPublishButtonProps = {
  publishing: boolean;
  saving: boolean;
  disabled: boolean;
  isDraftDirty: boolean;
  hasPublishableGraphChanges: boolean;
  publishPreview: PathwayPublishPreviewDto | null;
  publishPreviewLoading: boolean;
  publishPreviewError: string | null;
  onPublish: () => void;
};

/** Botão Publicar; quando desabilitado, o tooltip explica o motivo (na ordem de prioridade abaixo). */
export function PathwayPublishButton({
  publishing,
  saving,
  disabled,
  isDraftDirty,
  hasPublishableGraphChanges,
  publishPreview,
  publishPreviewLoading,
  publishPreviewError,
  onPublish,
}: PathwayPublishButtonProps) {
  const t = useTranslations("pathways.editor");

  const button = (
    <Button type="button" size="sm" variant="secondary" onClick={onPublish} disabled={disabled}>
      {publishing ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
      {t("publish")}
    </Button>
  );

  const idle = !publishing && !saving;
  let tooltip: string | null = null;
  if (idle) {
    if (isDraftDirty) tooltip = t("publishDisabledUnsavedTooltip");
    else if (!hasPublishableGraphChanges) tooltip = t("publishDisabledNoChangesTooltip");
    else if (publishPreviewLoading) tooltip = t("publishDisabledValidatingTooltip");
    else if (publishPreviewError) tooltip = t("publishPreviewFailed");
    else if (publishPreview && !publishPreview.canPublish) tooltip = t("publishDisabledPreviewTooltip");
  }
  if (tooltip === null) return button;

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex">{button}</span>} />
      <TooltipContent side="top" className="max-w-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
