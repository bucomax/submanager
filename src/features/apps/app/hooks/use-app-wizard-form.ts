"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { useTranslatedZodResolver } from "@/shared/lib/forms/translated-zod-resolver";
import { createApp, updateApp } from "@/features/apps/app/services/admin-apps.service";
import {
  uploadAppIcon,
  uploadAppScreenshot,
} from "@/features/apps/app/services/admin-app-upload.service";
import type { LocalScreenshot } from "@/features/apps/app/components/app-screenshots-upload";
import {
  STEP1_FIELDS,
  STEP2_FIELDS,
  buildAppRequestBody,
  buildWizardDefaults,
  wizardSchema,
  type WizardStep,
  type WizardValues,
} from "@/features/apps/app/utils/app-wizard-schema";
import type { AppDto } from "@/types/api/apps-v1";

type SaveInput = {
  values: WizardValues;
  publish: boolean;
  pendingIconFile: File | null;
  localScreenshots: LocalScreenshot[];
};

/** Estado do wizard de app (admin): form RHF, passo atual, uploads adiados (modo criação) e salvar. */
export function useAppWizardForm({
  editApp,
  onSaved,
  onClose,
}: {
  editApp?: AppDto | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<WizardStep>(1);
  const [pendingIconFile, setPendingIconFile] = useState<File | null>(null);
  const [iconBlobPreview, setIconBlobPreview] = useState<string | null>(null);
  const [localScreenshots, setLocalScreenshots] = useState<LocalScreenshot[]>([]);
  const isEdit = Boolean(editApp);

  const defaultValues = useMemo(() => buildWizardDefaults(editApp), [editApp]);
  const resolver = useTranslatedZodResolver<WizardValues>(wizardSchema);
  const form = useForm<WizardValues>({ resolver, defaultValues });

  // Blob URLs vivem só enquanto o wizard está montado.
  const blobsRef = useRef({ icon: iconBlobPreview, shots: localScreenshots });
  useEffect(() => {
    blobsRef.current = { icon: iconBlobPreview, shots: localScreenshots };
  }, [iconBlobPreview, localScreenshots]);
  useEffect(() => {
    const blobs = blobsRef;
    return () => {
      if (blobs.current.icon) URL.revokeObjectURL(blobs.current.icon);
      blobs.current.shots.forEach((s) => URL.revokeObjectURL(s.blobUrl));
    };
  }, []);

  const handleIconFileSelected = useCallback((file: File | null) => {
    if (blobsRef.current.icon) URL.revokeObjectURL(blobsRef.current.icon);
    setIconBlobPreview(file ? URL.createObjectURL(file) : null);
    setPendingIconFile(file);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async ({ values, publish, pendingIconFile: iconFile, localScreenshots: shots }: SaveInput) => {
      const body = buildAppRequestBody(values);
      let appId: string;
      if (isEdit && editApp) {
        await updateApp(editApp.id, { ...body, isPublished: publish ? true : undefined } as never);
        appId = editApp.id;
      } else {
        appId = (await createApp(body)).id;
        if (publish) await updateApp(appId, { isPublished: true } as never);
      }

      // Uploads adiados (modo criação): falha de upload não aborta o save.
      if (iconFile) await uploadAppIcon(appId, iconFile).catch(() => {});
      for (const shot of shots) {
        await uploadAppScreenshot(appId, shot.file).catch(() => {});
      }
    },
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });
  const { mutateAsync: saveAsync } = saveMutation;

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
    setStep((s) => (s > 1 ? ((s - 1) as WizardStep) : s));
  }, []);

  const handleSave = useCallback(
    async (publish: boolean) => {
      const valid = await form.trigger();
      if (!valid) {
        setStep(1);
        return;
      }
      try {
        await saveAsync({ values: form.getValues(), publish, pendingIconFile, localScreenshots });
      } catch {
        // apiClient trata toast
      }
    },
    [form, saveAsync, pendingIconFile, localScreenshots],
  );

  return {
    form,
    step,
    isEdit,
    saving: saveMutation.isPending,
    iconBlobPreview,
    localScreenshots,
    setLocalScreenshots,
    handleIconFileSelected,
    goToStep2,
    goToStep3,
    goBack,
    handleSave,
  };
}
