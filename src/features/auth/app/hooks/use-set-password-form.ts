"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { translatedZodResolver } from "@/shared/lib/forms/translated-zod-resolver";
import { resetPasswordWithToken } from "../services/password.service";
import type { SetPasswordFormValues } from "../types/auth";
import { setPasswordFormSchema } from "../utils/schemas";

export type UseSetPasswordFormOptions = {
  /** Rota após o countdown (default `/login`). */
  redirectTo?: string;
};

export function useSetPasswordForm(options: UseSetPasswordFormOptions = {}) {
  const { redirectTo = "/login" } = options;
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const tApi = useTranslations("api");

  const [done, setDone] = useState(false);

  const resolver = useMemo(
    () =>
      translatedZodResolver<SetPasswordFormValues>(setPasswordFormSchema, (key) =>
        tApi(key as Parameters<typeof tApi>[0]),
      ),
    [tApi],
  );

  const form = useForm<SetPasswordFormValues>({
    resolver,
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!token) {
      form.setError("newPassword", { message: tApi("errors.validationInviteTokenMissing") });
    }
  }, [token, form, tApi]);

  async function onSubmit(values: SetPasswordFormValues) {
    if (!token) return;
    const result = await resetPasswordWithToken({
      token,
      newPassword: values.newPassword,
    });
    if (!result.ok) {
      form.setError("newPassword", { message: result.message });
      return;
    }
    setDone(true);
  }

  return {
    form,
    done,
    redirectTo,
    tokenMissing: !token,
    onSubmit: form.handleSubmit(onSubmit),
    isSubmitting: form.formState.isSubmitting,
  };
}
