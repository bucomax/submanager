"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";

import { useClinicSettings } from "@/features/settings/app/hooks/use-clinic-settings";
import {
  clinicSettingsFormSchema,
  type ClinicSettingsFormValues,
} from "@/features/settings/app/utils/schemas";
import { digitsOnlyCep } from "@/lib/validators/cep";
import { digitsOnlyPhone } from "@/lib/validators/phone";
import { digitsOnlyTaxDocument } from "@/lib/validators/tax-document";
import { toast } from "@/lib/toast";
import { Form, FormCep, FormInput, FormPhoneNumber, FormTaxDocument, FormTextarea } from "@/shared/components/forms";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";

export function ClinicSettingsCard() {
  const t = useTranslations("settings.clinic");
  const {
    sessionStatus,
    tenant,
    loading,
    error,
    saving,
    canEdit,
    reload,
    saveClinicSettings,
  } = useClinicSettings();

  const form = useForm<ClinicSettingsFormValues>({
    resolver: zodResolver(clinicSettingsFormSchema),
    defaultValues: {
      name: "",
      taxId: "",
      phone: "",
      addressLine: "",
      city: "",
      postalCode: "",
      affiliatedHospitals: "",
    },
  });

  useEffect(() => {
    if (!tenant) return;
    form.reset({
      name: tenant.name,
      taxId: tenant.taxId ?? "",
      phone: tenant.phone ?? "",
      addressLine: tenant.addressLine ?? "",
      city: tenant.city ?? "",
      postalCode: tenant.postalCode ?? "",
      affiliatedHospitals: tenant.affiliatedHospitals ?? "",
    });
  }, [form, tenant]);

  async function onSubmit(values: ClinicSettingsFormValues) {
    try {
      const taxIdDigits = digitsOnlyTaxDocument(values.taxId ?? "");
      const phoneDigits = digitsOnlyPhone(values.phone ?? "");
      const cepDigits = digitsOnlyCep(values.postalCode ?? "");
      await saveClinicSettings({
        name: values.name,
        taxId: taxIdDigits.length > 0 ? taxIdDigits : "",
        phone: phoneDigits.length > 0 ? phoneDigits : "",
        addressLine: values.addressLine ?? "",
        city: values.city ?? "",
        postalCode: cepDigits.length === 8 ? cepDigits : "",
        affiliatedHospitals: values.affiliatedHospitals ?? "",
      });
      toast.success(t("saved"));
    } catch {
      /* erro: toast global no apiClient */
    }
  }

  if (sessionStatus === "loading" || (loading && !tenant && !error)) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full max-w-lg" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error && !tenant) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-destructive text-sm">{error}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
            <RefreshCw className="size-4" />
            {t("retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {t("refresh")}
          </Button>
        </div>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col">
          <CardContent className="space-y-4">
            {!canEdit ? (
              <p className="text-muted-foreground text-sm">{t("editForbidden")}</p>
            ) : null}
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
            <div className="grid gap-4 lg:grid-cols-2">
              <FormInput name="name" label={t("name")} disabled={saving || !canEdit} />
              <FormTaxDocument
                name="taxId"
                label={t("taxId")}
                placeholder={t("taxIdPlaceholder")}
                className="tabular-nums"
                disabled={saving || !canEdit}
              />
              <FormPhoneNumber
                name="phone"
                label={t("phone")}
                placeholder={t("phonePlaceholder")}
                className="tabular-nums"
                disabled={saving || !canEdit}
              />
              <FormCep
                name="postalCode"
                label={t("postalCode")}
                placeholder={t("postalCodePlaceholder")}
                disabled={saving || !canEdit}
              />
              <FormInput
                name="addressLine"
                label={t("addressLine")}
                placeholder={t("addressLinePlaceholder")}
                disabled={saving || !canEdit}
              />
              <FormInput
                name="city"
                label={t("city")}
                placeholder={t("cityPlaceholder")}
                disabled={saving || !canEdit}
              />
            </div>
            <FormTextarea
              name="affiliatedHospitals"
              label={t("affiliatedHospitals")}
              description={t("affiliatedHospitalsHint")}
              rows={4}
              disabled={saving || !canEdit}
            />
          </CardContent>
          <CardFooter className="mt-6 justify-end border-t pt-4">
            <Button type="submit" disabled={!canEdit || saving || !form.formState.isDirty}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {saving ? t("saving") : t("save")}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
