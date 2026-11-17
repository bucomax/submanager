"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  ArrowRight,
  Blocks,
  Loader2,
  Save,
  X,
} from "lucide-react";

import { createApp, updateApp } from "@/features/apps/app/services/admin-apps.service";
import { uploadAppIcon, uploadAppScreenshot } from "@/features/apps/app/services/admin-app-upload.service";
import { AppIconUpload } from "@/features/apps/app/components/app-icon-upload";
import { AppScreenshotsUpload, type LocalScreenshot } from "@/features/apps/app/components/app-screenshots-upload";
import type { AppDto, CreateAppRequestBody } from "@/types/api/apps-v1";
import { Dialog, StandardDialogContent } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Switch } from "@/shared/components/ui/switch";
import { Form, FormInput, FormSearchableSelect, FormSelect, FormTextarea } from "@/shared/components/forms";
import { FormColorPicker } from "@/shared/components/forms/form-color-picker";
import { Field, FieldLabel } from "@/shared/components/ui/field";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Form schema (subset for the wizard — backend does full validation)
// ---------------------------------------------------------------------------

const wizardSchema = z
  .object({
    // Step 1 — identity
    name: z.string().min(2).max(128),
    slug: z.string().max(64).optional().or(z.literal("")),
    tagline: z.string().max(256).optional().or(z.literal("")),
    description: z.string().max(10000).optional().or(z.literal("")),
    category: z.enum([
      "communication",
      "ai",
      "scheduling",
      "clinical",
      "financial",
      "integration",
    ]),
    accentColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional()
      .or(z.literal("")),
    developerName: z.string().max(128).optional().or(z.literal("")),
    developerUrl: z.string().max(512).optional().or(z.literal("")),

    // Step 2 — config
    renderMode: z.enum(["iframe", "internal", "external_link"]),
    iframeBaseUrl: z.string().max(2048).optional().or(z.literal("")),
    internalRoute: z.string().max(256).optional().or(z.literal("")),
    requiresConfig: z.boolean(),
    isFeatured: z.boolean(),
    sortOrder: z.coerce.number<number>().int().min(0).max(9999),

    // Step 2 — pricing
    pricingModel: z.enum(["free", "flat", "per_seat", "usage_based"]),
    priceInCents: z.coerce.number<number>().int().min(0).optional(),
    billingInterval: z.enum(["monthly", "yearly"]),
    trialDays: z.coerce.number<number>().int().min(0).max(365),
  })
  .refine(
    (d) => !(d.renderMode === "iframe" && !d.iframeBaseUrl),
    { message: "URL obrigatória para modo iframe.", path: ["iframeBaseUrl"] },
  )
  .refine(
    (d) => !(d.renderMode === "internal" && !d.internalRoute),
    { message: "Rota obrigatória para modo interno.", path: ["internalRoute"] },
  );

type WizardValues = z.infer<typeof wizardSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editApp?: AppDto | null;
  onSaved: () => void;
};

type Step = 1 | 2 | 3;

// Step 1 field names for partial validation
const STEP1_FIELDS: (keyof WizardValues)[] = [
  "name",
  "category",
  "tagline",
  "description",
  "accentColor",
  "developerName",
  "developerUrl",
];

const STEP2_FIELDS: (keyof WizardValues)[] = [
  "renderMode",
  "iframeBaseUrl",
  "internalRoute",
  "requiresConfig",
  "isFeatured",
  "sortOrder",
  "pricingModel",
  "priceInCents",
  "billingInterval",
  "trialDays",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdminAppWizardDialog({ open, onOpenChange, editApp, onSaved }: Props) {
  const t = useTranslations("apps.admin");
  const tw = useTranslations("apps.admin.wizard");
  const tCat = useTranslations("apps.catalog.categories");

  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(editApp);

  // Upload state (create mode — deferred upload)
  const [pendingIconFile, setPendingIconFile] = useState<File | null>(null);
  const [iconBlobPreview, setIconBlobPreview] = useState<string | null>(null);
  const [localScreenshots, setLocalScreenshots] = useState<LocalScreenshot[]>([]);

  const defaultValues: WizardValues = useMemo(
    () => ({
      name: editApp?.name ?? "",
      slug: editApp?.slug ?? "",
      tagline: editApp?.tagline ?? "",
      description: editApp?.description ?? "",
      category: editApp?.category ?? "integration",
      accentColor: editApp?.accentColor ?? "",
      developerName: editApp?.developerName ?? "",
      developerUrl: editApp?.developerUrl ?? "",
      renderMode: editApp?.renderMode ?? "iframe",
      iframeBaseUrl: editApp?.iframeBaseUrl ?? "",
      internalRoute: editApp?.internalRoute ?? "",
      requiresConfig: editApp?.requiresConfig ?? false,
      isFeatured: editApp?.isFeatured ?? false,
      sortOrder: editApp?.sortOrder ?? 0,
      pricingModel: editApp?.pricingModel ?? "free",
      priceInCents: editApp?.priceInCents ?? 0,
      billingInterval: editApp?.billingInterval ?? "monthly",
      trialDays: editApp?.trialDays ?? 0,
    }),
    [editApp],
  );

  const form = useForm<WizardValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues,
  });

  // Reset form when dialog opens/closes or editApp changes
  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
      setStep(1);
      setPendingIconFile(null);
      setIconBlobPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
      setLocalScreenshots((prev) => { prev.forEach((s) => URL.revokeObjectURL(s.blobUrl)); return []; });
    }
  }, [open, defaultValues, form]);

  // Icon file selection handler (create mode)
  const handleIconFileSelected = useCallback((file: File | null) => {
    setIconBlobPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    setPendingIconFile(file);
    if (file) {
      setIconBlobPreview(URL.createObjectURL(file));
    }
  }, []);

  // Watch fields for conditional rendering
  const renderMode = useWatch({ control: form.control, name: "renderMode" });
  const pricingModel = useWatch({ control: form.control, name: "pricingModel" });

  // Category options
  const categoryOptions = useMemo(
    () =>
      (["communication", "ai", "scheduling", "clinical", "financial", "integration"] as const).map(
        (c) => ({ value: c, label: tCat(c) }),
      ),
    [tCat],
  );

  const renderModeOptions = useMemo(
    () => [
      { value: "iframe", label: tw("renderModeIframe") },
      { value: "internal", label: tw("renderModeInternal") },
      { value: "external_link", label: tw("renderModeExternal") },
    ],
    [tw],
  );

  const pricingModelOptions = useMemo(
    () => [
      { value: "free", label: tw("pricingFree") },
      { value: "flat", label: tw("pricingFlat") },
      { value: "per_seat", label: tw("pricingPerSeat") },
      { value: "usage_based", label: tw("pricingUsageBased") },
    ],
    [tw],
  );

  const billingIntervalOptions = useMemo(
    () => [
      { value: "monthly", label: tw("billingMonthly") },
      { value: "yearly", label: tw("billingYearly") },
    ],
    [tw],
  );

  // -- Navigation ---------------------------------------------------------------

  const goToStep2 = useCallback(() => {
    void form.trigger(STEP1_FIELDS).then((valid) => {
      if (valid) setStep(2);
    });
  }, [form]);

  const goToStep3 = useCallback(() => {
    void form.trigger(STEP2_FIELDS).then((valid) => {
      if (valid) setStep(3);
    });
  }, [form]);

  const goBack = useCallback(() => {
    setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
  }, []);

  // -- Submit -------------------------------------------------------------------

  const handleSave = useCallback(
    async (publish: boolean) => {
      const valid = await form.trigger();
      if (!valid) {
        setStep(1);
        return;
      }

      const v = form.getValues();
      const body: CreateAppRequestBody = {
        name: v.name,
        category: v.category,
        renderMode: v.renderMode,
        ...(v.slug ? { slug: v.slug } : {}),
        ...(v.tagline ? { tagline: v.tagline } : {}),
        ...(v.description ? { description: v.description } : {}),
        ...(v.accentColor ? { accentColor: v.accentColor } : {}),
        ...(v.developerName ? { developerName: v.developerName } : {}),
        ...(v.developerUrl ? { developerUrl: v.developerUrl } : {}),
        ...(v.iframeBaseUrl ? { iframeBaseUrl: v.iframeBaseUrl } : {}),
        ...(v.internalRoute ? { internalRoute: v.internalRoute } : {}),
        requiresConfig: v.requiresConfig,
        isFeatured: v.isFeatured,
        sortOrder: v.sortOrder,
        pricingModel: v.pricingModel,
        ...(v.pricingModel !== "free" ? { priceInCents: v.priceInCents } : {}),
        billingInterval: v.billingInterval,
        trialDays: v.trialDays,
      };

      setSaving(true);
      try {
        let appId: string;
        if (isEdit && editApp) {
          await updateApp(editApp.id, { ...body, isPublished: publish ? true : undefined } as never);
          appId = editApp.id;
        } else {
          const created = await createApp(body);
          appId = created.id;
          if (publish) {
            await updateApp(appId, { isPublished: true } as never);
          }
        }

        // Deferred uploads (create mode)
        if (pendingIconFile) {
          await uploadAppIcon(appId, pendingIconFile).catch(() => {});
        }
        if (localScreenshots.length > 0) {
          for (const shot of localScreenshots) {
            await uploadAppScreenshot(appId, shot.file).catch(() => {});
          }
        }

        onSaved();
        onOpenChange(false);
      } catch {
        // apiClient trata toast
      } finally {
        setSaving(false);
      }
    },
    [form, isEdit, editApp, onSaved, onOpenChange, pendingIconFile, localScreenshots],
  );

  // -- Step indicator -----------------------------------------------------------

  const stepClass = (n: Step) =>
    cn(
      "flex size-7 items-center justify-center rounded-full text-xs font-medium transition-colors",
      step >= n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
    );

  function handleDialogOpenChange(next: boolean) {
    if (saving && !next) return;
    onOpenChange(next);
  }

  // -- Render -------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      {open ? (
        <StandardDialogContent
          size="lg"
          showCloseButton={!saving}
          title={isEdit ? t("editApp") : t("newApp")}
          footer={
            <div className="flex w-full items-center justify-between">
              <div>
                {step > 1 && (
                  <Button type="button" variant="outline" size="sm" disabled={saving} onClick={goBack}>
                    <ArrowLeft className="size-3.5" />
                    {tw("back")}
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={() => onOpenChange(false)}
                >
                  <X className="size-3.5" />
                  {tw("cancel")}
                </Button>
                {step < 3 ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={step === 1 ? goToStep2 : goToStep3}
                  >
                    {tw("next")}
                    <ArrowRight className="size-3.5" />
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saving}
                      onClick={() => void handleSave(false)}
                    >
                      {saving ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Save className="size-3.5" />
                      )}
                      {tw("saveDraft")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={saving}
                      onClick={() => void handleSave(true)}
                    >
                      {saving ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : null}
                      {tw("publishApp")}
                    </Button>
                  </>
                )}
              </div>
            </div>
          }
        >
          {/* Step indicator */}
          <div className="mb-4 flex items-center gap-2">
            <div className={stepClass(1)}>1</div>
            <span className="text-muted-foreground text-xs">—</span>
            <div className={stepClass(2)}>2</div>
            <span className="text-muted-foreground text-xs">—</span>
            <div className={stepClass(3)}>3</div>
            <span className="ml-2 text-xs text-muted-foreground">
              {step === 1 && tw("step1")}
              {step === 2 && tw("step2")}
              {step === 3 && tw("preview")}
            </span>
          </div>

          <Form {...form}>
            <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
              {/* =================== STEP 1 — Identity =================== */}
              {step === 1 && (
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
                    onFileSelected={handleIconFileSelected}
                    localPreview={iconBlobPreview}
                  />

                  <AppScreenshotsUpload
                    appId={editApp?.id ?? null}
                    screenshots={editApp?.screenshots ?? []}
                    onChanged={() => onSaved()}
                    localScreenshots={localScreenshots}
                    onLocalScreenshotsChange={setLocalScreenshots}
                  />
                </>
              )}

              {/* =================== STEP 2 — Config & Pricing =================== */}
              {step === 2 && (
                <>
                  <FormSearchableSelect
                    name="renderMode"
                    label={tw("renderMode")}
                    options={renderModeOptions}
                  />

                  {renderMode === "iframe" && (
                    <FormInput
                      name="iframeBaseUrl"
                      label={tw("iframeBaseUrl")}
                      description={tw("iframeBaseUrlHint")}
                      placeholder="https://app.example.com/embed"
                      autoFocus
                    />
                  )}
                  {renderMode === "internal" && (
                    <FormInput
                      name="internalRoute"
                      label={tw("internalRoute")}
                      placeholder="/dashboard/apps/my-app"
                      autoFocus
                    />
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field>
                      <div className="flex items-center justify-between">
                        <FieldLabel>{tw("requiresConfig")}</FieldLabel>
                        <Switch
                          checked={form.watch("requiresConfig")}
                          onCheckedChange={(v) => form.setValue("requiresConfig", v)}
                        />
                      </div>
                    </Field>
                    <Field>
                      <div className="flex items-center justify-between">
                        <FieldLabel>{tw("isFeatured")}</FieldLabel>
                        <Switch
                          checked={form.watch("isFeatured")}
                          onCheckedChange={(v) => form.setValue("isFeatured", v)}
                        />
                      </div>
                    </Field>
                  </div>

                  <FormInput
                    name="sortOrder"
                    label={tw("sortOrder")}
                    type="number"
                    min={0}
                    max={9999}
                  />

                  <hr className="my-2" />
                  <p className="text-sm font-medium">{tw("pricing")}</p>

                  <FormSearchableSelect
                    name="pricingModel"
                    label={tw("pricingModel")}
                    options={pricingModelOptions}
                  />

                  {pricingModel !== "free" && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <FormInput
                        name="priceInCents"
                        label={tw("priceInCents")}
                        type="number"
                        min={0}
                      />
                      <FormSelect
                        name="billingInterval"
                        label={tw("billingInterval")}
                        options={billingIntervalOptions}
                      />
                      <FormInput
                        name="trialDays"
                        label={tw("trialDays")}
                        type="number"
                        min={0}
                        max={365}
                      />
                    </div>
                  )}
                </>
              )}

              {/* =================== STEP 3 — Preview =================== */}
              {step === 3 && (
                <StepPreview
                  values={form.getValues()}
                  iconPreview={iconBlobPreview ?? editApp?.iconUrl ?? null}
                  screenshotCount={
                    (editApp?.screenshots.length ?? 0) + localScreenshots.length
                  }
                />
              )}
            </form>
          </Form>
        </StandardDialogContent>
      ) : null}
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Preview component
// ---------------------------------------------------------------------------

function StepPreview({
  values,
  iconPreview,
  screenshotCount,
}: {
  values: WizardValues;
  iconPreview: string | null;
  screenshotCount: number;
}) {
  const tw = useTranslations("apps.admin.wizard");
  const tCat = useTranslations("apps.catalog.categories");

  const pricingLabel = {
    free: tw("pricingFree"),
    flat: tw("pricingFlat"),
    per_seat: tw("pricingPerSeat"),
    usage_based: tw("pricingUsageBased"),
  }[values.pricingModel];

  const renderLabel = {
    iframe: tw("renderModeIframe"),
    internal: tw("renderModeInternal"),
    external_link: tw("renderModeExternal"),
  }[values.renderMode];

  return (
    <div className="space-y-4">
      {/* Card preview */}
      <div
        className="flex items-center gap-4 rounded-xl border p-4"
        style={
          values.accentColor
            ? { borderTopColor: values.accentColor, borderTopWidth: 3 }
            : undefined
        }
      >
        {iconPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconPreview} alt="" className="size-14 shrink-0 rounded-2xl object-cover" />
        ) : (
          <div
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-muted"
            style={values.accentColor ? { backgroundColor: `${values.accentColor}15` } : undefined}
          >
            <Blocks
              className="size-7"
              style={values.accentColor ? { color: values.accentColor } : undefined}
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{values.name || "—"}</h3>
          {values.tagline && (
            <p className="text-sm text-muted-foreground">{values.tagline}</p>
          )}
          {values.developerName && (
            <p className="text-xs text-muted-foreground">{values.developerName}</p>
          )}
        </div>
        <Badge variant="outline" className="text-xs">
          {tCat(values.category)}
        </Badge>
      </div>

      {/* Details grid */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {values.slug && (
          <div>
            <dt className="text-muted-foreground">{tw("slug")}</dt>
            <dd className="font-medium font-mono text-xs">{values.slug}</dd>
          </div>
        )}
        <div>
          <dt className="text-muted-foreground">{tw("renderMode")}</dt>
          <dd className="font-medium">{renderLabel}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{tw("pricingModel")}</dt>
          <dd className="font-medium">{pricingLabel}</dd>
        </div>
        {values.pricingModel !== "free" && (
          <div>
            <dt className="text-muted-foreground">{tw("priceInCents")}</dt>
            <dd className="font-medium">
              {((values.priceInCents ?? 0) / 100).toFixed(2)} / {values.billingInterval}
            </dd>
          </div>
        )}
        {values.trialDays > 0 && (
          <div>
            <dt className="text-muted-foreground">{tw("trialDays")}</dt>
            <dd className="font-medium">{values.trialDays}</dd>
          </div>
        )}
        <div>
          <dt className="text-muted-foreground">{tw("isFeatured")}</dt>
          <dd className="font-medium">{values.isFeatured ? "Sim" : "Não"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{tw("requiresConfig")}</dt>
          <dd className="font-medium">{values.requiresConfig ? "Sim" : "Não"}</dd>
        </div>
        {screenshotCount > 0 && (
          <div>
            <dt className="text-muted-foreground">{tw("screenshots")}</dt>
            <dd className="font-medium">{screenshotCount}</dd>
          </div>
        )}
      </dl>

      {values.description && (
        <div>
          <p className="mb-1 text-sm text-muted-foreground">{tw("description")}</p>
          <div className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap">
            {values.description}
          </div>
        </div>
      )}
    </div>
  );
}
