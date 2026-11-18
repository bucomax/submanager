"use client";

import { useClientPathwayOptions } from "@/features/clients/app/hooks/use-client-pathway-options";
import { useCreateClientFlow } from "@/features/clients/app/hooks/use-create-client-flow";
import { buildNewClientPayloadInput, PICKER_NONE } from "@/features/clients/app/utils/new-client-payload";
import { newClientFormSchema, type NewClientFormValues } from "@/features/clients/app/utils/schemas";
import { useTenantSettingsPickers } from "@/features/settings/app/hooks/use-tenant-settings-pickers";
import { useRouter } from "@/i18n/navigation";
import { joinTranslatedZodIssues } from "@/lib/api/zod-i18n";
import { toast } from "@/lib/toast";
import { postClientBodySchema } from "@/lib/validators/client";
import { translatedZodResolver } from "@/shared/lib/forms/translated-zod-resolver";
import { PatientPreferredChannel } from "@prisma/client";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";

export type NewClientWizardStep = 1 | 2 | 3;

type UseNewClientWizardParams = {
  submitBehavior: "navigateToClients" | "callback";
  onFlowComplete?: () => void;
};

const DEFAULT_VALUES: NewClientFormValues = {
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
};

/** Orquestra o wizard de novo paciente: formulário da etapa 1, escolha de fluxo e envio. */
export function useNewClientWizard({ submitBehavior, onFlowComplete }: UseNewClientWizardParams) {
  const t = useTranslations("clients.wizard");
  const tApi = useTranslations("api");
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const tenantId = session?.user?.tenantId ?? null;
  const [step, setStep] = useState<NewClientWizardStep>(1);
  const [pathwayId, setPathwayId] = useState<string | null>(null);
  const [assignedToUserId, setAssignedToUserId] = useState(PICKER_NONE);
  const [opmeSupplierId, setOpmeSupplierId] = useState(PICKER_NONE);
  const { submitting, submitClientFlow } = useCreateClientFlow();
  const pickers = useTenantSettingsPickers({
    enabled: step === 1 && sessionStatus === "authenticated" && Boolean(tenantId),
    fallbackErrorMessage: t("errorGeneric"),
  });
  const pathwayOptions = useClientPathwayOptions({
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
  const form = useForm<NewClientFormValues>({ resolver, defaultValues: DEFAULT_VALUES });

  const selectedPathway = useMemo(
    () => pathwayOptions.eligiblePathways.find((p) => p.id === pathwayId) ?? null,
    [pathwayOptions.eligiblePathways, pathwayId],
  );

  function goBack() {
    if (step === 1) return;
    setStep(step === 2 ? 1 : 2);
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

  function resetWizard() {
    setStep(1);
    setPathwayId(null);
    setAssignedToUserId(PICKER_NONE);
    setOpmeSupplierId(PICKER_NONE);
    form.reset();
  }

  async function handleSubmitAll() {
    if (!pathwayId) {
      toast.error(t("errorGeneric"));
      return;
    }
    const parsed = postClientBodySchema.safeParse(
      buildNewClientPayloadInput(form.getValues(), assignedToUserId, opmeSupplierId),
    );
    if (!parsed.success) {
      const msg = joinTranslatedZodIssues(parsed.error, (key) =>
        tApi(key as Parameters<typeof tApi>[0]),
      );
      toast.error(msg || t("errorGeneric"));
      return;
    }
    try {
      await submitClientFlow({ payload: parsed.data, pathwayId });
      toast.success(t("success"));
      if (submitBehavior === "callback") {
        resetWizard();
        onFlowComplete?.();
      } else {
        router.push("/dashboard/clients");
        router.refresh();
      }
    } catch {
      /* erro: toast global no apiClient */
    }
  }

  return {
    form,
    step,
    submitting,
    goBack,
    goNextFromStep1,
    goNextFromStep2,
    handleSubmitAll,
    sessionReady: sessionStatus === "authenticated",
    assignedToUserId,
    setAssignedToUserId,
    opmeSupplierId,
    setOpmeSupplierId,
    pickers,
    pathwayId,
    setPathwayId,
    pathwayOptions,
    selectedPathway,
  };
}
