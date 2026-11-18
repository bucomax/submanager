"use client";

import { useStageDocuments } from "@/features/pathways/app/hooks/use-stage-documents";
import { normalizeStageDocumentDraftItems } from "@/domain/pathway/graph-normalizer";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { ExternalLink, FileText, Info, Loader2, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";

type PathwayStageDocumentsBlockProps = {
  stageDocuments: unknown;
  onDocumentsAdded: (items: { fileAssetId: string; fileName: string; mimeType: string }[]) => void;
  onRemove: (fileAssetId: string) => void;
};

export function PathwayStageDocumentsBlock({
  stageDocuments,
  onDocumentsAdded,
  onRemove,
}: PathwayStageDocumentsBlockProps) {
  const t = useTranslations("pathways.editor");
  const inputRef = useRef<HTMLInputElement>(null);
  const { pendingRows, openingId, openFile, uploadFiles } = useStageDocuments({ onDocumentsAdded });
  const docs = normalizeStageDocumentDraftItems(stageDocuments);

  const anyUploading = pendingRows.length > 0;

  return (
    <div className="border-border/55 w-full min-w-0 space-y-3 border-t pt-5">
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        multiple
        accept="application/pdf,image/*,.pdf"
        onChange={(e) => {
          void uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-foreground text-sm font-semibold tracking-tight">{t("stageDocumentsTitle")}</p>
        <p className="text-muted-foreground max-w-prose text-xs leading-snug">{t("stageDocumentsDescription")}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit gap-1.5"
          onClick={() => inputRef.current?.click()}
        >
          {anyUploading ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
          {t("addStageDocument")}
        </Button>
      </div>

      {docs.length === 0 && pendingRows.length === 0 ? (
        <Alert variant="info" className="border-border/60 bg-muted/25 py-2.5">
          <Info className="size-4" aria-hidden />
          <AlertDescription className="text-muted-foreground text-sm">{t("stageDocumentsEmpty")}</AlertDescription>
        </Alert>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {pendingRows.map((row) => (
            <li
              key={row.tempId}
              className="border-primary/20 from-primary/[0.05] overflow-hidden rounded-lg border bg-gradient-to-br to-transparent p-3 ring-1 ring-primary/10"
            >
              <div className="flex items-center gap-2.5">
                <Loader2 className="text-primary size-4 shrink-0 animate-spin" aria-hidden />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="min-w-0">
                    <p
                      className="text-foreground line-clamp-2 break-words text-sm font-medium leading-snug"
                      title={row.fileName}
                    >
                      {row.fileName}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">{t("uploadingStageDocument")}</p>
                  </div>
                  <div className="bg-muted/80 h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className="from-primary h-full rounded-full bg-gradient-to-r to-primary/75 transition-[width] duration-200 ease-out"
                      style={{ width: `${Math.max(row.progress, 4)}%` }}
                    />
                  </div>
                </div>
              </div>
            </li>
          ))}
          {docs.map((d) => (
            <li
              key={d.fileAssetId}
              className={cn(
                "group flex min-w-0 items-center gap-2 rounded-lg border border-border/70 bg-muted/20 px-2 py-1.5 transition-colors",
                "hover:border-border hover:bg-muted/40",
              )}
            >
              <FileText
                className="text-muted-foreground group-hover:text-foreground size-4 shrink-0"
                aria-hidden
              />
              <p
                className="text-foreground min-w-0 flex-1 break-words text-sm font-medium leading-snug [overflow-wrap:anywhere] line-clamp-2"
                title={d.fileName}
              >
                {d.fileName}
              </p>
              <div className="flex shrink-0 items-center gap-0.5 self-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-foreground"
                  disabled={openingId === d.fileAssetId}
                  onClick={() => void openFile(d.fileAssetId)}
                  aria-label={t("openStageDocumentAria")}
                >
                  {openingId === d.fileAssetId ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <ExternalLink className="size-3.5" aria-hidden />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive/90 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => onRemove(d.fileAssetId)}
                  aria-label={t("removeStageDocumentAria")}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
