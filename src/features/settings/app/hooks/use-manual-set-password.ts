"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { setInviteePassword } from "@/features/settings/app/services/admin-set-invitee-password.service";
import { toast } from "@/lib/toast";
import { portalPasswordSchema } from "@/lib/validators/patient-portal-auth";

const manualSetPasswordSchema = z
  .object({
    password: portalPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export type ManualSetPasswordFormValues = z.infer<typeof manualSetPasswordSchema>;

type UseManualSetPasswordOptions = {
  userId: string;
  tenantId: string;
  onSuccess?: () => void;
  onOpenChange: (open: boolean) => void;
};

export function useManualSetPassword({
  userId,
  tenantId,
  onSuccess,
  onOpenChange,
}: UseManualSetPasswordOptions) {
  const t = useTranslations("settings.manualSetPassword");

  const resolver = useMemo(() => zodResolver(manualSetPasswordSchema), []);

  const form = useForm<ManualSetPasswordFormValues>({
    resolver,
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(values: ManualSetPasswordFormValues) {
    await setInviteePassword({ userId, tenantId, password: values.password });
    toast.success(t("successToast"));
    onOpenChange(false);
    onSuccess?.();
  }

  return {
    form,
    onSubmit: form.handleSubmit(onSubmit),
    isSubmitting: form.formState.isSubmitting,
    t,
  };
}
