"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { AppIconUpload } from "@/features/apps/app/components/app-icon-upload";
import { AppScreenshotsUpload, type LocalScreenshot } from "@/features/apps/app/components/app-screenshots-upload";
import type { AppDto } from "@/types/api/apps-v1";
import { FormInput, FormSearchableSelect, FormTextarea } from "@/shared/components/forms";
import { FormColorPicker } from "@/shared/components/forms/form-color-picker";

type Props = {
  editApp?: AppDto | null;
  onSaved: () => void;
  iconBlobPreview: string | null;
  onIconFileSelected: (file: File | null) => void;
  localScreenshots: LocalScreenshot[];
  onLocalScreenshotsChange: (shots: LocalScreenshot[]) => void;
};

const CATEGORIES = ["communication", "ai", "scheduling", "clinical", "financial", "integration"] as const;

/** Passo 1 do wizard: identidade, ícone e screenshots. */
export function AppWizardStepIdentity({
  editApp,
  onSaved,
  iconBlobPreview,
  onIconFileSelected,
  localScreenshots,
  onLocalScreenshotsChange,
}: Props) {
  const tw = useTranslations("apps.admin.wizard");
  const tCat = useTranslations("apps.catalog.categories");

  const categoryOptions = useMemo(
    () => CATEGORIES.map((c) => ({ value: c, label: tCat(c) })),
    [tCat],
  );

  return (
    <>
    <FormInput
      name="name"
      label={tw("name")}
      placeholder={tw("namePlaceholder")}
      autoFocus
    />
    <FormInput name="slug" label={tw("slug")} placeholder="meu-app" />
    <FormInput
      name="tagline"
      label={tw("tagline")}
      placeholder={tw("taglinePlaceholder")}
    />
    <FormTextarea
      name="description"
      label={tw("description")}
      placeholder={tw("descriptionPlaceholder")}
      rows={3}
    />
    <FormSearchableSelect
      name="category"
      label={tw("category")}
      options={categoryOptions}
      searchPlaceholder={tw("categorySearch")}
    />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormColorPicker
        name="accentColor"
        label={tw("accentColor")}
        clearable
      />
      <FormInput name="developerName" label={tw("developerName")} />
    </div>
    <FormInput
      name="developerUrl"
      label={tw("developerUrl")}
      placeholder="https://..."
    />

    <hr className="my-2" />

    <AppIconUpload
      appId={editApp?.id ?? null}
      currentIconUrl={editApp?.iconUrl ?? null}
      onChanged={() => onSaved()}
      onFileSelected={onIconFileSelected}
      localPreview={iconBlobPreview}
    />

    <AppScreenshotsUpload
      appId={editApp?.id ?? null}
      screenshots={editApp?.screenshots ?? []}
      onChanged={() => onSaved()}
      localScreenshots={localScreenshots}
      onLocalScreenshotsChange={onLocalScreenshotsChange}
    />
    </>
  );
}
