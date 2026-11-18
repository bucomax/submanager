"use client";

import { Loader2, Plus, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { PathwayPublishButton } from "@/features/pathways/app/components/pathway-publish-button";
import { Button } from "@/shared/components/ui/button";
import { CardFooter } from "@/shared/components/ui/card";
import type { PathwayPublishPreviewDto } from "@/types/api/pathways-v1";

type PathwayEditorToolbarProps = {
  saving: boolean;
  publishing: boolean;
  publishDisabled: boolean;
  isDraftDirty: boolean;
  hasPublishableGraphChanges: boolean;
  publishPreview: PathwayPublishPreviewDto | null;
  publishPreviewLoading: boolean;
  publishPreviewError: string | null;
  onAddStage: () => void;
  onSave: () => void;
  onPublish: () => void;
};

/** Rodapé do canvas (somente admin): adicionar etapa, salvar rascunho, publicar. */
export function PathwayEditorToolbar({
  saving,
  publishing,
  publishDisabled,
  isDraftDirty,
  hasPublishableGraphChanges,
  publishPreview,
  publishPreviewLoading,
  publishPreviewError,
  onAddStage,
  onSave,
  onPublish,
}: PathwayEditorToolbarProps) {
  const t = useTranslations("pathways.editor");

  return (
    <CardFooter className="flex flex-wrap items-center gap-2 border-t">
      <Button type="button" variant="outline" size="sm" onClick={onAddStage}>
        <Plus className="size-4" />
        {t("addStage")}
      </Button>
      <Button type="button" size="sm" onClick={onSave} disabled={saving}>
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        {t("save")}
      </Button>
      <PathwayPublishButton
        publishing={publishing}
        saving={saving}
        disabled={publishDisabled}
        isDraftDirty={isDraftDirty}
        hasPublishableGraphChanges={hasPublishableGraphChanges}
        publishPreview={publishPreview}
        publishPreviewLoading={publishPreviewLoading}
        publishPreviewError={publishPreviewError}
        onPublish={onPublish}
      />
    </CardFooter>
  );
}
