"use client";

import { GripVertical, ImagePlus, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";

import {
  uploadAppScreenshot,
  removeAppScreenshot,
  reorderAppScreenshots,
} from "@/features/apps/app/services/admin-app-upload.service";
import type { AppScreenshotDto } from "@/types/api/apps-v1";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { Field, FieldDescription, FieldLabel } from "@/shared/components/ui/field";

const ACCEPT_IMAGES = "image/jpeg,image/png,image/webp";
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_SCREENSHOTS = 8;

// ---------------------------------------------------------------------------
// Local-only screenshot (create mode, before app exists)
// ---------------------------------------------------------------------------

export type LocalScreenshot = {
  id: string; // temp id
  file: File;
  blobUrl: string;
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  /** appId — null means "new app, not yet created" */
  appId: string | null;
  /** Existing screenshots from server (edit mode) */
  screenshots: AppScreenshotDto[];
  /** Called after upload/remove/reorder so parent can refresh */
  onChanged: () => void;
  /** In create mode, collect files for deferred upload */
  localScreenshots?: LocalScreenshot[];
  onLocalScreenshotsChange?: (shots: LocalScreenshot[]) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AppScreenshotsUpload({
  appId,
  screenshots,
  onChanged,
  localScreenshots,
  onLocalScreenshotsChange,
}: Props) {
  const tw = useTranslations("apps.admin.wizard");
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCreateMode = !appId;
  const currentCount = isCreateMode
    ? (localScreenshots?.length ?? 0)
    : screenshots.length;
  const canAdd = currentCount < MAX_SCREENSHOTS;

  // -- Add files --

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const validFiles: File[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
          toast.error(tw("screenshotInvalidType"));
          continue;
        }
        if (file.size > MAX_SIZE_BYTES) {
          toast.error(tw("screenshotTooLarge"));
          continue;
        }
        validFiles.push(file);
      }

      if (validFiles.length === 0) return;

      const slotsLeft = MAX_SCREENSHOTS - currentCount;
      const toUpload = validFiles.slice(0, slotsLeft);
      if (validFiles.length > slotsLeft) {
        toast.error(tw("screenshotMaxReached"));
      }

      if (isCreateMode && onLocalScreenshotsChange && localScreenshots) {
        const newShots: LocalScreenshot[] = toUpload.map((f) => ({
          id: crypto.randomUUID(),
          file: f,
          blobUrl: URL.createObjectURL(f),
        }));
        onLocalScreenshotsChange([...localScreenshots, ...newShots]);
        return;
      }

      if (!appId) return;

      setUploading(true);
      try {
        for (const file of toUpload) {
          await uploadAppScreenshot(appId, file);
        }
        onChanged();
      } catch {
        // apiClient handles toast
      } finally {
        setUploading(false);
      }
    },
    [appId, isCreateMode, localScreenshots, onLocalScreenshotsChange, onChanged, currentCount, tw],
  );

  // -- Remove --

  const handleRemove = useCallback(
    async (screenshotId: string) => {
      if (isCreateMode && onLocalScreenshotsChange && localScreenshots) {
        const shot = localScreenshots.find((s) => s.id === screenshotId);
        if (shot) URL.revokeObjectURL(shot.blobUrl);
        onLocalScreenshotsChange(localScreenshots.filter((s) => s.id !== screenshotId));
        return;
      }

      if (!appId) return;

      setRemovingId(screenshotId);
      try {
        await removeAppScreenshot(appId, screenshotId);
        onChanged();
      } catch {
        // apiClient handles toast
      } finally {
        setRemovingId(null);
      }
    },
    [appId, isCreateMode, localScreenshots, onLocalScreenshotsChange, onChanged],
  );

  // -- Move (simple up/down for now — drag & drop would be a future enhancement) --

  const handleMoveUp = useCallback(
    async (index: number) => {
      if (index <= 0) return;

      if (isCreateMode && onLocalScreenshotsChange && localScreenshots) {
        const reordered = [...localScreenshots];
        [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
        onLocalScreenshotsChange(reordered);
        return;
      }

      if (!appId) return;

      const reordered = [...screenshots];
      [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
      try {
        await reorderAppScreenshots(appId, reordered.map((s) => s.id));
        onChanged();
      } catch {
        // apiClient handles toast
      }
    },
    [appId, isCreateMode, localScreenshots, onLocalScreenshotsChange, screenshots, onChanged],
  );

  // -- Items to render --

  const items: { id: string; imageUrl: string }[] = isCreateMode
    ? (localScreenshots ?? []).map((s) => ({ id: s.id, imageUrl: s.blobUrl }))
    : screenshots.map((s) => ({ id: s.id, imageUrl: s.imageUrl }));

  return (
    <Field>
      <FieldLabel>{tw("screenshots")}</FieldLabel>
      <FieldDescription>{tw("screenshotsHint")}</FieldDescription>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_IMAGES}
        multiple
        className="sr-only"
        disabled={uploading || !canAdd}
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Grid of thumbnails */}
      {items.length > 0 && (
        <div className="mt-2 grid grid-cols-4 gap-2">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="group relative aspect-video overflow-hidden rounded-lg border bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt={tw("screenshotAlt", { index: idx + 1 })}
                loading="lazy"
                className="size-full object-cover"
              />

              {/* Overlay actions */}
              <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                {idx > 0 && (
                  <button
                    type="button"
                    className="rounded-full bg-white/90 p-1 text-xs hover:bg-white"
                    onClick={() => void handleMoveUp(idx)}
                    title={tw("screenshotMoveLeft")}
                    aria-label={tw("screenshotMoveLeft")}
                  >
                    <GripVertical className="size-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  className="rounded-full bg-white/90 p-1 text-destructive hover:bg-white"
                  onClick={() => void handleRemove(item.id)}
                  disabled={removingId === item.id}
                  title={tw("screenshotRemove")}
                  aria-label={tw("screenshotRemove")}
                >
                  {removingId === item.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <X className="size-3.5" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add zone */}
      {canAdd && (
        <button
          type="button"
          disabled={uploading}
          className={cn(
            "mt-2 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed py-4 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground",
            dragOverZone && "border-primary bg-primary/5",
            uploading && "pointer-events-none opacity-60",
          )}
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={(e) => { e.preventDefault(); setDragOverZone(true); }}
          onDragOver={(e) => { e.preventDefault(); setDragOverZone(true); }}
          onDragLeave={(e) => {
            e.preventDefault();
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverZone(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverZone(false);
            void handleFiles(e.dataTransfer.files);
          }}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ImagePlus className="size-4" />
          )}
          {tw("screenshotAdd")}
          <span className="text-xs text-muted-foreground">
            ({currentCount}/{MAX_SCREENSHOTS})
          </span>
        </button>
      )}
    </Field>
  );
}
