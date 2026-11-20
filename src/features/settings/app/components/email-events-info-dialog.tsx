"use client";

import { Info } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";

import {
  SearchableSelectDropdown,
  type SearchableSelectOption,
} from "@/shared/components/forms/form-searchable-select";
import { Button } from "@/shared/components/ui/button";
import { Dialog, StandardDialogContent } from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import {
  getTenantEmailPreviewPath,
  type EmailPreviewKind,
} from "@/features/settings/app/services/tenant-email-preview.service";

export type { EmailPreviewKind };

const PREVIEW_KINDS: {
  value: EmailPreviewKind;
  labelKey:
    | "previewKindStage"
    | "previewKindSla"
    | "previewKindFile"
    | "previewKindChecklist"
    | "previewKindSurgery"
    | "previewKindWeekly"
    | "previewKindDocuments";
}[] = [
  { value: "stage_transition", labelKey: "previewKindStage" },
  { value: "sla_alert", labelKey: "previewKindSla" },
  { value: "file_pending_review", labelKey: "previewKindFile" },
  { value: "checklist_complete", labelKey: "previewKindChecklist" },
  { value: "surgery_reminder", labelKey: "previewKindSurgery" },
  { value: "weekly_report", labelKey: "previewKindWeekly" },
  { value: "document_delivery", labelKey: "previewKindDocuments" },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EmailEventsInfoDialog({ open, onOpenChange }: Props) {
  const t = useTranslations("settings.email.events");
  const locale = useLocale();
  const [kind, setKind] = useState<EmailPreviewKind>("stage_transition");
  const selectId = useId();

  const previewSrc = getTenantEmailPreviewPath(kind);

  const previewOptions: SearchableSelectOption[] = useMemo(
    () =>
      PREVIEW_KINDS.map((k) => ({
        value: k.value,
        label: t(k.labelKey),
        keywords: [k.value.replace(/_/g, " ")],
      })),
    [t],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <StandardDialogContent
          size="xl"
          title={t("modalTitle")}
          description={t("modalIntro")}
          bodyClassName="min-h-0"
          className="max-w-4xl"
          footer={
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t("close")}
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-foreground text-sm font-medium">{t("patientSectionTitle")}</p>
                <ul className="text-muted-foreground list-inside list-disc space-y-1.5 text-sm leading-relaxed">
                  <li>{t("patientItem1")}</li>
                  <li>{t("patientItem2")}</li>
                  <li>{t("patientItem3")}</li>
                </ul>
                <p className="text-foreground text-sm font-medium pt-1">{t("staffSectionTitle")}</p>
                <ul className="text-muted-foreground list-inside list-disc space-y-1.5 text-sm leading-relaxed">
                  <li>{t("staffItem1")}</li>
                  <li>{t("staffItem2")}</li>
                  <li>{t("staffItem3")}</li>
                </ul>
                <p className="text-muted-foreground border-border mt-1 border-t pt-3 text-xs leading-relaxed">
                  {t("otherNote")}
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">{t("footerNote")}</p>
                <p className="text-muted-foreground text-xs leading-relaxed">{t("disclaimer")}</p>
              </div>
              <div className="flex min-h-0 min-w-0 flex-col gap-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Label htmlFor={selectId} className="text-foreground text-sm">
                      {t("previewLabel")}
                    </Label>
                    <SearchableSelectDropdown
                      id={selectId}
                      value={kind}
                      onChange={(v) => {
                        if (v) setKind(v as EmailPreviewKind);
                      }}
                      options={previewOptions}
                      placeholder={t("previewLabel")}
                      searchPlaceholder={t("searchExample")}
                      emptyMessage={t("emptyNoMatch")}
                      className="w-full min-w-0"
                    />
                  </div>
                </div>
                <p className="text-muted-foreground text-xs">
                  {t("iframeHint")}
                </p>
                <div className="bg-muted/40 border-border min-h-[28rem] overflow-hidden rounded-lg border">
                  <iframe
                    key={kind}
                    title={t("modalTitle")}
                    src={previewSrc}
                    className="h-[28rem] w-full min-w-0 border-0 bg-white"
                    loading="lazy"
                    lang={locale}
                  />
                </div>
              </div>
            </div>
          </div>
        </StandardDialogContent>
      ) : null}
    </Dialog>
  );
}

export function EmailEventsInfoCallout({ onOpen }: { onOpen: () => void }) {
  const t = useTranslations("settings.email.events");
  return (
    <div className="bg-info-soft border-info/30 text-info flex flex-col gap-2 rounded-lg border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="flex min-w-0 gap-2">
        <Info className="text-info mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug">{t("boxTitle")}</p>
          <p className="text-info mt-0.5 text-xs leading-relaxed">
            {t("boxDescription")}
          </p>
        </div>
      </div>
      <Button type="button" variant="secondary" size="sm" className="w-full shrink-0 sm:w-auto" onClick={onOpen}>
        {t("openModal")}
      </Button>
    </div>
  );
}
