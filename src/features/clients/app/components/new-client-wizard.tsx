"use client";

import { translatedZodResolver } from "@/shared/lib/forms/translated-zod-resolver";
import { useCreateClientFlow } from "@/features/clients/app/hooks/use-create-client-flow";
import { useClientPathwayOptions } from "@/features/clients/app/hooks/use-client-pathway-options";
import { useRouter } from "@/i18n/navigation";
import { toast } from "@/lib/toast";
import { formatCepDisplay } from "@/lib/validators/cep";
import { formatCpfDisplay } from "@/lib/validators/cpf";
import { formatPhoneBrDisplay } from "@/lib/validators/phone";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/components/ui/card";
import {
  Form,
  FormCep,
  FormCpf,
  FormBirthDateInput,
  FormInput,
  FormPhoneNumber,
  FormSelect,
  FormTextarea,
} from "@/shared/components/forms";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Field, FieldDescription, FieldLabel } from "@/shared/components/ui/field";
import { useTenantSettingsPickers } from "@/features/settings/app/hooks/use-tenant-settings-pickers";
import { newClientFormSchema, type NewClientFormValues } from "@/features/clients/app/utils/schemas";
import { GuardianRelationship, PatientPreferredChannel } from "@prisma/client";
import { joinTranslatedZodIssues } from "@/lib/api/zod-i18n";
import { postClientBodySchema } from "@/lib/validators/client";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

const PICKER_NONE = "__none__";

type Step = 1 | 2 | 3;

export type NewClientWizardProps = {
  /** `callback`: fecha modal / chama `onFlowComplete` sem redirecionar. Padrão: lista de clientes. */
  submitBehavior?: "navigateToClients" | "callback";
  onFlowComplete?: () => void;
};

export function NewClientWizard({
  submitBehavior = "navigateToClients",
  onFlowComplete,
}: NewClientWizardProps = {}) {
  const t = useTranslations("clients.wizard");
  const tApi = useTranslations("api");
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const tenantId = session?.user?.tenantId ?? null;
  const [step, setStep] = useState<Step>(1);
  const [pathwayId, setPathwayId] = useState<string | null>(null);
  const [assignedToUserId, setAssignedToUserId] = useState(PICKER_NONE);
  const [opmeSupplierId, setOpmeSupplierId] = useState(PICKER_NONE);
  const { submitting, submitClientFlow } = useCreateClientFlow();
  const {
    members,
    suppliers,
    error: pickersError,
  } = useTenantSettingsPickers({
    enabled: step === 1 && sessionStatus === "authenticated" && Boolean(tenantId),
    fallbackErrorMessage: t("errorGeneric"),
  });
  const {
    eligiblePathways,
    loading: pathwaysLoading,
    error: pathwaysError,
  } = useClientPathwayOptions({
    enabled: step === 2,
    fallbackErrorMessage: t("errorGeneric"),
  });

  const resolver = useMemo(
    () =>
      translatedZodResolver<NewClientFormValues>(newClientFormSchema, (key) =>
        tApi(key as Parameters<typeof tApi>[0]),
      ),
    [tApi],
  );

  const form = useForm<NewClientFormValues>({
    resolver,
    defaultValues: {
      name: "",
      phone: "",
      caseDescription: "",
      documentId: "",
      email: "",
      isMinor: false,
      guardianName: "",
      guardianDocumentId: "",
      guardianPhone: "",
      guardianEmail: "",
      birthDate: "",
      guardianRelationship: undefined,
      emergencyContactName: "",
      emergencyContactPhone: "",
      preferredChannel: PatientPreferredChannel.none,
      postalCode: "",
      addressLine: "",
      addressNumber: "",
      addressComp: "",
      neighborhood: "",
      city: "",
      state: "",
    },
  });

  const isMinorWatched = useWatch({ control: form.control, name: "isMinor" });

  const guardianRelationshipOptions = useMemo(
    () =>
      (
        [
          [GuardianRelationship.mother, "guardianRelationship.mother"],
          [GuardianRelationship.father, "guardianRelationship.father"],
          [GuardianRelationship.legal_guardian, "guardianRelationship.legal_guardian"],
          [GuardianRelationship.other, "guardianRelationship.other"],
        ] as const
      ).map(([value, key]) => ({ value, label: t(key) })),
    [t],
  );

  const preferredChannelOptions = useMemo(
    () =>
      (
        [
          [PatientPreferredChannel.none, "preferredChannelOption.none"],
          [PatientPreferredChannel.email, "preferredChannelOption.email"],
          [PatientPreferredChannel.whatsapp, "preferredChannelOption.whatsapp"],
          [PatientPreferredChannel.sms, "preferredChannelOption.sms"],
        ] as const
      ).map(([value, key]) => ({ value, label: t(key) })),
    [t],
  );

  const selectedPathway = useMemo(
    () => eligiblePathways.find((p) => p.id === pathwayId) ?? null,
    [eligiblePathways, pathwayId],
  );
  const reviewPhone = String(form.getValues("phone") ?? "");
  const reviewDocumentId = String(form.getValues("documentId") ?? "");
  const reviewIsMinor = Boolean(form.getValues("isMinor"));
  const reviewPostal = String(form.getValues("postalCode") ?? "");

  function goBack() {
    if (step === 1) return;
    if (step === 2) {
      setStep(1);
      return;
    }
    setStep(2);
  }

  function goNextFromStep1() {
    void form.handleSubmit(() => setStep(2))();
  }

  function goNextFromStep2() {
    if (!pathwayId) {
      toast.error(t("pathwayPlaceholder"));
      return;
    }
    setStep(3);
  }

  async function handleSubmitAll() {
    const values = form.getValues();
    try {
      if (!pathwayId) {
        toast.error(t("errorGeneric"));
        return;
      }
      const parsed = postClientBodySchema.safeParse({
        name: String(values.name ?? "").trim(),
        phone: String(values.phone ?? ""),
        caseDescription: String(values.caseDescription ?? "").trim() || undefined,
        documentId: values.documentId ?? "",
        email: String(values.email ?? "").trim(),
        assignedToUserId: assignedToUserId === PICKER_NONE ? undefined : assignedToUserId,
        opmeSupplierId: opmeSupplierId === PICKER_NONE ? undefined : opmeSupplierId,
        isMinor: Boolean(values.isMinor),
        guardianName: String(values.guardianName ?? "").trim() || undefined,
        guardianDocumentId: values.guardianDocumentId ?? "",
        guardianPhone: String(values.guardianPhone ?? ""),
        guardianEmail: String(values.guardianEmail ?? "").trim() || undefined,
        birthDate: String(values.birthDate ?? "").trim() || undefined,
        guardianRelationship: values.guardianRelationship,
        emergencyContactName: String(values.emergencyContactName ?? "").trim() || undefined,
        emergencyContactPhone: String(values.emergencyContactPhone ?? ""),
        preferredChannel: values.preferredChannel ?? PatientPreferredChannel.none,
        postalCode: String(values.postalCode ?? "").trim() || undefined,
        addressLine: String(values.addressLine ?? "").trim() || undefined,
        addressNumber: String(values.addressNumber ?? "").trim() || undefined,
        addressComp: String(values.addressComp ?? "").trim() || undefined,
        neighborhood: String(values.neighborhood ?? "").trim() || undefined,
        city: String(values.city ?? "").trim() || undefined,
        state: String(values.state ?? "").trim() || undefined,
      });
      if (!parsed.success) {
        const msg = joinTranslatedZodIssues(parsed.error, (key) =>
          tApi(key as Parameters<typeof tApi>[0]),
        );
        toast.error(msg || t("errorGeneric"));
        return;
      }
      await submitClientFlow({
        payload: parsed.data,
        pathwayId,
      });
      toast.success(t("success"));
      if (submitBehavior === "callback") {
        setStep(1);
        setPathwayId(null);
        setAssignedToUserId(PICKER_NONE);
        setOpmeSupplierId(PICKER_NONE);
        form.reset();
        onFlowComplete?.();
      } else {
        router.push("/dashboard/clients");
        router.refresh();
      }
    } catch {
      /* erro: toast global no apiClient */
    }
  }

  const stepClass = (n: Step) =>
    cn(
      "flex size-8 items-center justify-center rounded-full text-sm font-medium",
      step >= n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
    );

  return (
    <Card className="border-border shadow-sm">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <div className={stepClass(1)}>1</div>
          <span className="text-muted-foreground hidden sm:inline">—</span>
          <div className={stepClass(2)}>2</div>
          <span className="text-muted-foreground hidden sm:inline">—</span>
          <div className={stepClass(3)}>3</div>
        </div>
        <CardTitle className="sr-only">{t("title")}</CardTitle>
        <CardDescription className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-xs">
          <span className={step === 1 ? "text-foreground font-medium" : ""}>{t("step1")}</span>
          <span className={step === 2 ? "text-foreground font-medium" : ""}>{t("step2")}</span>
          <span className={step === 3 ? "text-foreground font-medium" : ""}>{t("step3")}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...form}>
          {step === 1 ? (
            <div className="flex flex-col gap-4">
              <div className="bg-muted/40 space-y-4 rounded-lg border p-4">
                <p className="text-sm font-medium">{t("patientSection")}</p>
                <div className="grid gap-4 lg:grid-cols-3">
                  <FormInput name="name" label={t("name")} autoComplete="name" />
                  <FormPhoneNumber
                    name="phone"
                    label={isMinorWatched ? t("phoneMinor") : t("phone")}
                    description={isMinorWatched ? t("phoneMinorHint") : t("phoneHint")}
                  />
                  <FormInput
                    name="email"
                    label={isMinorWatched ? t("emailMinor") : t("email")}
                    description={isMinorWatched ? t("emailMinorHint") : t("emailHint")}
                    type="email"
                    autoComplete="email"
                  />
                </div>
                <FormCpf
                  name="documentId"
                  label={isMinorWatched ? t("documentIdMinor") : t("documentId")}
                  description={isMinorWatched ? t("documentIdMinorHint") : t("documentIdHint")}
                />
                <div className="grid gap-4 lg:grid-cols-2">
                  <FormBirthDateInput
                    name="birthDate"
                    label={t("birthDate")}
                    description={t("birthDateHint")}
                    autoComplete="bday"
                  />
                  <FormSelect
                    name="preferredChannel"
                    label={t("preferredChannelField")}
                    description={t("preferredChannelHint")}
                    options={preferredChannelOptions}
                  />
                </div>
                <Controller
                  name="isMinor"
                  control={form.control}
                  render={({ field }) => (
                    <label className="border-border bg-background/60 flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm">
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          field.onChange(checked);
                          if (!checked) {
                            form.setValue("guardianName", "");
                            form.setValue("guardianDocumentId", "");
                            form.setValue("guardianPhone", "");
                            form.setValue("guardianEmail", "");
                            form.setValue("guardianRelationship", undefined);
                          }
                        }}
                        className="mt-0.5 size-4"
                      />
                      <span className="min-w-0">{t("isMinor")}</span>
                    </label>
                  )}
                />
              </div>
              {isMinorWatched ? (
                <div className="bg-muted/40 space-y-4 rounded-lg border p-4">
                  <p className="text-sm font-medium">{t("guardianSection")}</p>
                  <div className="grid gap-4 lg:grid-cols-3">
                    <FormInput name="guardianName" label={t("guardianName")} autoComplete="name" />
                    <FormCpf name="guardianDocumentId" label={t("guardianDocumentId")} />
                    <FormPhoneNumber name="guardianPhone" label={t("guardianPhone")} />
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <FormSelect
                      name="guardianRelationship"
                      label={t("guardianRelationshipLabel")}
                      description={t("guardianRelationshipHint")}
                      placeholder={t("guardianRelationshipPlaceholder")}
                      options={guardianRelationshipOptions}
                    />
                    <FormInput
                      name="guardianEmail"
                      label={t("guardianEmail")}
                      description={t("guardianEmailHint")}
                      type="email"
                      autoComplete="email"
                    />
                  </div>
                </div>
              ) : null}
              <div className="bg-muted/40 space-y-4 rounded-lg border p-4">
                <p className="text-sm font-medium">{t("emergencySection")}</p>
                <div className="grid gap-4 lg:grid-cols-2">
                  <FormInput name="emergencyContactName" label={t("emergencyContactName")} />
                  <FormPhoneNumber name="emergencyContactPhone" label={t("emergencyContactPhone")} />
                </div>
              </div>
              {pickersError ? <p className="text-destructive text-sm">{pickersError}</p> : null}
              <div className="grid gap-4 lg:grid-cols-2">
                <Field>
                  <FieldLabel>{t("assignedTo")}</FieldLabel>
                  <Select
                    value={assignedToUserId}
                    onValueChange={(v) => setAssignedToUserId(v ?? PICKER_NONE)}
                    disabled={sessionStatus !== "authenticated" || members === null}
                  >
                    <SelectTrigger className="w-full max-w-md">
                      <SelectValue placeholder={t("assignedPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={PICKER_NONE}>{t("noneOption")}</SelectItem>
                      {(members ?? []).map((m) => (
                        <SelectItem key={m.userId} value={m.userId}>
                          {m.name ?? m.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>{t("opme")}</FieldLabel>
                  <Select
                    value={opmeSupplierId}
                    onValueChange={(v) => setOpmeSupplierId(v ?? PICKER_NONE)}
                    disabled={sessionStatus !== "authenticated" || suppliers === null}
                  >
                    <SelectTrigger className="w-full max-w-md">
                      <SelectValue placeholder={t("opmePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={PICKER_NONE}>{t("noneOption")}</SelectItem>
                      {(suppliers ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <FormTextarea
                name="caseDescription"
                label={t("caseDescription")}
                description={t("caseDescriptionHint")}
                rows={4}
              />
              <div className="bg-muted/40 space-y-4 rounded-lg border p-4">
                <p className="text-sm font-medium">{t("addressSection")}</p>
                <div className="grid gap-4 lg:grid-cols-2">
                  <FormCep
                    name="postalCode"
                    label={t("postalCode")}
                    description={t("postalCodeHint")}
                  />
                  <FormInput name="addressLine" label={t("addressLine")} autoComplete="street-address" />
                  <FormInput name="addressNumber" label={t("addressNumber")} />
                  <FormInput name="addressComp" label={t("addressComp")} required={false} />
                  <FormInput name="neighborhood" label={t("neighborhood")} />
                  <FormInput name="city" label={t("city")} autoComplete="address-level2" />
                  <FormInput name="state" label={t("state")} maxLength={2} className="uppercase" />
                </div>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-3">
              {pathwaysLoading ? (
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Loader2 className="size-4 animate-spin" />
                  {t("pathwayLoading")}
                </div>
              ) : null}
              {pathwaysError ? (
                <p className="text-destructive text-sm">{pathwaysError}</p>
              ) : null}
              {!pathwaysLoading && eligiblePathways.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("pathwayEmpty")}</p>
              ) : null}
              {!pathwaysLoading && eligiblePathways.length > 0 ? (
                <Field>
                  <FieldLabel>{t("pathwayLabel")}</FieldLabel>
                  <FieldDescription>{t("pathwayHelp")}</FieldDescription>
                  <Select
                    value={pathwayId ?? undefined}
                    onValueChange={(v) => setPathwayId(v ?? null)}
                  >
                    <SelectTrigger className="w-full max-w-md" size="default">
                      <SelectValue placeholder={t("pathwayPlaceholder")}>
                        {(value) => {
                          if (value == null) return t("pathwayPlaceholder");
                          const p = eligiblePathways.find((x) => x.id === value);
                          if (!p) return value;
                          return (
                            <>
                              {p.name}
                              {p.publishedVersion ? ` · v${p.publishedVersion.version}` : ""}
                            </>
                          );
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {eligiblePathways.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                          {p.publishedVersion ? ` · v${p.publishedVersion.version}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3 text-sm">
              <p className="font-medium">{t("reviewTitle")}</p>
              <dl className="grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">{t("reviewName")}</dt>
                  <dd>{form.getValues("name")}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("reviewPhone")}</dt>
                  <dd>{formatPhoneBrDisplay(reviewPhone)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("email")}</dt>
                  <dd>{String(form.getValues("email") ?? "").trim() || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {reviewIsMinor ? t("documentIdMinor") : t("documentId")}
                  </dt>
                  <dd>{reviewDocumentId ? formatCpfDisplay(reviewDocumentId) : "—"}</dd>
                </div>
                {reviewIsMinor ? (
                  <>
                    <div className="sm:col-span-2">
                      <dt className="text-muted-foreground">{t("guardianSection")}</dt>
                      <dd>
                        {String(form.getValues("guardianName") ?? "").trim() || "—"} ·{" "}
                        {String(form.getValues("guardianDocumentId") ?? "").trim()
                          ? formatCpfDisplay(String(form.getValues("guardianDocumentId")))
                          : "—"}
                      </dd>
                    </div>
                  </>
                ) : null}
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">{t("addressSection")}</dt>
                  <dd className="space-y-0.5">
                    <span className="block">
                      {reviewPostal ? formatCepDisplay(reviewPostal) : "—"}
                      {String(form.getValues("addressLine") ?? "").trim()
                        ? ` · ${String(form.getValues("addressLine")).trim()}`
                        : ""}
                      {String(form.getValues("addressNumber") ?? "").trim()
                        ? `, ${String(form.getValues("addressNumber")).trim()}`
                        : ""}
                    </span>
                    {String(form.getValues("addressComp") ?? "").trim() ? (
                      <span className="text-muted-foreground block text-xs">
                        {String(form.getValues("addressComp")).trim()}
                      </span>
                    ) : null}
                    <span className="block">
                      {[
                        String(form.getValues("neighborhood") ?? "").trim(),
                        String(form.getValues("city") ?? "").trim(),
                        String(form.getValues("state") ?? "").trim().toUpperCase(),
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </span>
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">{t("reviewPathway")}</dt>
                  <dd>{selectedPathway?.name ?? "—"}</dd>
                </div>
                {selectedPathway?.publishedVersion ? (
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">{t("reviewVersion")}</dt>
                    <dd>v{selectedPathway.publishedVersion.version}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          ) : null}
        </Form>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 border-t">
        {step > 1 ? (
          <Button type="button" variant="outline" size="sm" onClick={goBack} disabled={submitting}>
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            {t("back")}
          </Button>
        ) : null}
        {step === 1 ? (
          <Button type="button" size="sm" onClick={goNextFromStep1}>
            {t("next")}
            <ArrowRight className="size-4 shrink-0" aria-hidden />
          </Button>
        ) : null}
        {step === 2 ? (
          <Button
            type="button"
            size="sm"
            onClick={goNextFromStep2}
            disabled={eligiblePathways.length === 0}
          >
            {t("next")}
            <ArrowRight className="size-4 shrink-0" aria-hidden />
          </Button>
        ) : null}
        {step === 3 ? (
          <Button type="button" size="sm" onClick={() => void handleSubmitAll()} disabled={submitting}>
            {submitting ? (
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Check className="size-4 shrink-0" aria-hidden />
            )}
            {submitting ? t("submitting") : t("submit")}
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
