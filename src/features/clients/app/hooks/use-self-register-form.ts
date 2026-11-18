"use client";

import {
  patientSelfRegisterFormSchema,
  type PatientSelfRegisterFormValues,
} from "@/features/clients/app/utils/schemas";
import {
  SELF_REGISTER_DEFAULT_VALUES,
  valuesFromPrefill,
} from "@/features/clients/app/utils/self-register-form-values";
import { joinTranslatedZodIssues } from "@/lib/api/zod-i18n";
import { submitPatientSelfRegister } from "@/lib/api/patient-self-register-public";
import { toast } from "@/lib/toast";
import { collectRhfErrorMessages, scrollFirstInvalidFieldIntoView } from "@/lib/utils/form";
import { syncMaskedFormFieldsFromDom } from "@/lib/utils/sync-masked-form-fields-from-dom";
import { digitsOnlyCep } from "@/lib/validators/cep";
import { publicPatientSelfRegisterBodySchema } from "@/lib/validators/client";
import { digitsOnlyCpf } from "@/lib/validators/cpf";
import { digitsOnlyPhone } from "@/lib/validators/phone";
import { translatedZodResolver } from "@/shared/lib/forms/translated-zod-resolver";
import type { PublicPatientSelfRegisterFormPrefillDto } from "@/types/api/clients-v1";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useForm, type FieldErrors } from "react-hook-form";

type UseSelfRegisterFormParams = {
  token: string | null;
  tenantSlug: string | undefined;
  formPrefill: PublicPatientSelfRegisterFormPrefillDto | null;
};

/** Formulário público de auto-cadastro: validação Zod em duas camadas + envio do convite. */
export function useSelfRegisterForm({ token, tenantSlug, formPrefill }: UseSelfRegisterFormParams) {
  const t = useTranslations("clients");
  const tApi = useTranslations("api");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const submit = useMutation({
    mutationFn: (body: Parameters<typeof submitPatientSelfRegister>[0]) =>
      submitPatientSelfRegister(body, tenantSlug),
  });

  const resolver = useMemo(
    () =>
      translatedZodResolver<PatientSelfRegisterFormValues>(patientSelfRegisterFormSchema, (key) =>
        tApi(key as Parameters<typeof tApi>[0]),
      ),
    [tApi],
  );
  const form = useForm<PatientSelfRegisterFormValues>({
    resolver,
    shouldFocusError: true,
    defaultValues: SELF_REGISTER_DEFAULT_VALUES,
  });

  const { reset } = form;
  useEffect(() => {
    if (formPrefill) reset(valuesFromPrefill(formPrefill));
  }, [formPrefill, reset]);

  function failSubmit(description: string) {
    setSubmitError(description);
    toast.error(t("selfRegister.submitFailedTitle"), { description });
  }

  async function onSubmit(values: PatientSelfRegisterFormValues) {
    if (!token) {
      const msg = t("selfRegister.invalidTokenBody");
      setSubmitError(msg);
      toast.error(msg, { description: t("selfRegister.invalidTokenTitle") });
      return;
    }
    setSubmitError(null);
    const parsed = patientSelfRegisterFormSchema.safeParse(values);
    if (!parsed.success) {
      failSubmit(joinTranslatedZodIssues(parsed.error, tApi as (key: string) => string));
      return;
    }
    const { confirmPassword: _confirmOmit, ...fields } = parsed.data;
    void _confirmOmit;
    const requestBody = { ...fields, token };
    const apiParsed = publicPatientSelfRegisterBodySchema.safeParse(requestBody);
    if (!apiParsed.success) {
      failSubmit(joinTranslatedZodIssues(apiParsed.error, tApi as (key: string) => string));
      return;
    }
    let result: Awaited<ReturnType<typeof submitPatientSelfRegister>>;
    try {
      result = await submit.mutateAsync(requestBody);
    } catch {
      failSubmit(t("selfRegister.submitNetworkError"));
      return;
    }
    if (!result.ok) {
      failSubmit(result.message);
      return;
    }
    setSubmitted(true);
  }

  function onValidationFailed(errors: FieldErrors<PatientSelfRegisterFormValues>) {
    const messages = collectRhfErrorMessages(errors);
    const description =
      messages.length > 0 ? messages.slice(0, 4).join(" · ") : t("selfRegister.fixFieldsHint");
    failSubmit(description);
    scrollFirstInvalidFieldIntoView();
  }

  function handleFormSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    syncMaskedFormFieldsFromDom(e.currentTarget, form.setValue, [
      { name: "phone", normalize: digitsOnlyPhone },
      { name: "guardianPhone", normalize: digitsOnlyPhone },
      { name: "documentId", normalize: digitsOnlyCpf },
      { name: "guardianDocumentId", normalize: digitsOnlyCpf },
      { name: "postalCode", normalize: digitsOnlyCep },
    ]);
    void form.handleSubmit(onSubmit, onValidationFailed)(e);
  }

  return { form, submitError, submitted, handleFormSubmit };
}
