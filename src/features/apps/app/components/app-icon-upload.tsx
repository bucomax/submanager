"use client";

import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";

import { useAppIconMutations } from "@/features/apps/app/hooks/use-app-icon-mutations";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/shared/components/ui/field";

const ACCEPT_IMAGES = "image/jpeg,image/png,image/webp,image/svg+xml";
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

type Props = {
  /** appId — null means "new app, not yet created" */
  appId: string | null;
  /** Current icon URL (from the server) */
  currentIconUrl: string | null;
  /** Called after upload/remove succeeds so parent can refresh */
  onChanged: (iconUrl: string | null) => void;
  /** In create mode, collect the file for deferred upload */
  onFileSelected?: (file: File | null) => void;
  /** Local blob preview (managed by parent in create mode) */
  localPreview?: string | null;
};

export function AppIconUpload({
  appId,
  currentIconUrl,
  onChanged,
  onFileSelected,
  localPreview,
}: Props) {
  const tw = useTranslations("apps.admin.wizard");
  const { upload, uploading, progress, remove, removing } = useAppIconMutations();
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = uploading || removing;
  const previewSrc = localPreview ?? currentIconUrl;

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;

      if (!file.type.match(/^image\/(jpeg|png|webp|svg\+xml)$/)) {
        toast.error(tw("iconInvalidType"));
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        toast.error(tw("iconTooLarge"));
        return;
      }

      // Create mode — defer upload
      if (!appId) {
        onFileSelected?.(file);
        return;
      }

      // Edit mode — upload immediately
      try {
        const res = await upload({ appId, file });
        onChanged(res.publicUrl);
      } catch {
        // apiClient handles toast
      }
    },
    [appId, onChanged, onFileSelected, tw, upload],
  );

  const handleRemove = useCallback(async () => {
    if (!appId) {
      onFileSelected?.(null);
      onChanged(null);
      return;
    }

    try {
      await remove(appId);
      onChanged(null);
    } catch {
      // apiClient handles toast
    }
  }, [appId, onChanged, onFileSelected, remove]);

  return (
    <Field>
      <FieldLabel>{tw("icon")}</FieldLabel>
      <FieldDescription>{tw("iconHint")}</FieldDescription>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_IMAGES}
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <div className="mt-2 flex items-center gap-4">
        {/* Drop zone / preview */}
        <button
          type="button"
          disabled={busy}
          className={cn(
            "relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-colors",
            dragOver && "border-primary bg-primary/5",
            busy && "pointer-events-none opacity-60",
            !previewSrc && "bg-muted/40",
          )}
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={(e) => {
            e.preventDefault();
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void handleFile(e.dataTransfer.files?.[0]);
          }}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-1">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">{progress}%</span>
            </div>
          ) : previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewSrc} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlus className="size-8 text-muted-foreground" />
          )}
        </button>

        {/* Actions */}
        <div className="flex flex-col gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            {previewSrc ? tw("iconChange") : tw("iconChoose")}
          </Button>
          {previewSrc && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void handleRemove()}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-1 size-3.5" />
              {tw("iconRemove")}
            </Button>
          )}
        </div>
      </div>
    </Field>
  );
}
