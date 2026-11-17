"use client";

import { useTranslatedZodResolver } from "@/shared/lib/forms/translated-zod-resolver";
import { normalizeCallbackPath } from "@/features/auth/app/utils/callback-path";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { LoginFormValues } from "../types/auth";
import { loginSchema } from "../utils/schemas";

export function useLoginForm() {
  const searchParams = useSearchParams();
  const t = useTranslations("auth");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const defaultCallback = "/dashboard";
  const callbackUrl = normalizeCallbackPath(searchParams.get("callbackUrl"), defaultCallback);

  const resolver = useTranslatedZodResolver<LoginFormValues>(loginSchema);
  const form = useForm<LoginFormValues>({
    resolver,
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginFormValues) {
    setSubmitError(null);
    const res = await signIn("credentials", {
      email: values.email.trim().toLowerCase(),
      password: values.password,
      redirect: false,
      callbackUrl,
    });

    if (res?.error) {
      setSubmitError(t("login.invalidCredentials"));
      return;
    }

    const path = callbackUrl.startsWith("/") ? callbackUrl : `/${callbackUrl}`;
    window.location.assign(path);
  }

  return {
    form,
    submitError,
    onSubmit: form.handleSubmit(onSubmit),
  };
}
