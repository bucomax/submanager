"use client";

import { ChevronDown, ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";

import { useProfileAvatarUpload } from "@/features/settings/app/hooks/use-profile-avatar-upload";
import type { ProfileFormValues } from "@/features/settings/app/utils/schemas";
import { toast } from "@/lib/toast";
import { USER_PROFILE_IMAGE_GCS_PREFIX } from "@/lib/utils/user-profile-image-ref";
import { cn } from "@/lib/utils";
import { FormInput } from "@/shared/components/forms";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldLabel } from "@/shared/components/ui/field";
import { Skeleton } from "@/shared/components/ui/skeleton";

const ACCEPT_IMAGES = "image/jpeg,image/png,image/webp,image/gif";

type AccountProfileImageFieldProps = {
  /** URL resolvida pelo servidor para `gcs:`; também atualizada após salvar. */
  displayUrl: string | null;
};

export function AccountProfileImageField({ displayUrl }: AccountProfileImageFieldProps) {
  const t = useTranslations("settings.profile");
  const { setValue, watch } = useFormContext<ProfileFormValues>();
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { storageState, uploading, upload } = useProfileAvatarUpload();
  const [dragOver, setDragOver] = useState(false);
  // Preview local vale só para o `displayUrl` em que foi criado; ao salvar (novo displayUrl) some sem efeito.
  const [preview, setPreview] = useState<{ src: string; displayUrl: string | null } | null>(null);
  const blobPreview = preview && preview.displayUrl === displayUrl ? preview.src : null;

  const storedImage = watch("image")?.trim() ?? "";

  const previewSrc = preview?.src;
  useEffect(() => {
    if (!previewSrc) return;
    return () => URL.revokeObjectURL(previewSrc);
  }, [previewSrc]);

  const avatarSrc =
    blobPreview ??
    (storedImage.startsWith(USER_PROFILE_IMAGE_GCS_PREFIX) ? displayUrl : storedImage || null);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      const url = await upload(file);
      if (url === null) return;
      setPreview({ src: URL.createObjectURL(file), displayUrl });
      setValue("image", url, { shouldDirty: true, shouldValidate: true });
    },
    [displayUrl, setValue, upload],
  );

  function openFilePicker() {
    if (storageState === "unavailable") {
      toast.error(t("imageStorageUnavailable"));
      return;
    }
    window.setTimeout(() => fileInputRef.current?.click(), 0);
  }

  /** Só bloqueia envio quando o servidor declarou explicitamente indisponível. */
  const lockedOut = storageState === "unavailable";
  const canUploadFile = storageState === "available" || storageState === "unknown";

  if (storageState === null) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <div className="flex items-center gap-4">
          <Skeleton className="size-20 shrink-0 rounded-full" />
          <Skeleton className="h-4 max-w-xs flex-1" />
        </div>
      </div>
    );
  }

  return (
    <Field>
      <FieldLabel htmlFor={inputId}>{t("image")}</FieldLabel>
      <FieldDescription>
        {lockedOut ? t("imageUploadHintNoStorage") : t("imageUploadHint")}
      </FieldDescription>
      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept={ACCEPT_IMAGES}
        className="sr-only"
        disabled={uploading || lockedOut}
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div
        className={cn(
          "mt-2 flex min-h-[5.5rem] max-w-lg items-center gap-4 rounded-xl border border-dashed px-3 py-3 transition-colors",
          lockedOut && "border-muted-foreground/30 bg-muted/20",
          dragOver && canUploadFile && "border-primary bg-primary/5",
          uploading && "pointer-events-none opacity-70",
        )}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (canUploadFile) setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (canUploadFile) setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragOver(false);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          void handleFile(e.dataTransfer.files?.[0]);
        }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                className="relative size-20 shrink-0 overflow-hidden rounded-full p-0 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={t("imageChangeAria")}
              >
                {uploading ? (
                  <span className="bg-muted/80 absolute inset-0 flex items-center justify-center">
                    <Loader2 className="text-muted-foreground size-7 animate-spin" aria-hidden />
                  </span>
                ) : avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL do storage ou legado
                  <img src={avatarSrc} alt="" className="size-full object-cover" />
                ) : (
                  <span className="bg-muted/60 text-muted-foreground flex size-full items-center justify-center">
                    <ImagePlus className="size-9" aria-hidden />
                  </span>
                )}
                <span className="pointer-events-none absolute right-0 bottom-0 flex size-7 items-center justify-center rounded-full border border-border bg-background shadow-sm">
                  <ChevronDown className="size-3.5 opacity-80" aria-hidden />
                </span>
              </Button>
            }
          />
          <DropdownMenuContent align="start" className="min-w-[12rem]">
            <DropdownMenuItem onClick={openFilePicker}>
              <Upload className="size-4" />
              {t("imageChooseFile")}
            </DropdownMenuItem>
            {storedImage ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() =>
                    setValue("image", "", { shouldDirty: true, shouldValidate: true })
                  }
                >
                  <Trash2 className="size-4" />
                  {t("imageClear")}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
        <p className="text-muted-foreground flex-1 text-sm leading-snug">
          {dragOver && canUploadFile
            ? t("imageDropRelease")
            : lockedOut
              ? t("imageDropDisabledHint")
              : t("imageDropHint")}
        </p>
      </div>
      {lockedOut ? (
        <div className="mt-4 max-w-lg space-y-2">
          <FormInput
            name="image"
            label={t("imageUrlManualLabel")}
            description={t("imageHint")}
            type="url"
            autoComplete="off"
            placeholder="https://"
          />
        </div>
      ) : null}
    </Field>
  );
}
