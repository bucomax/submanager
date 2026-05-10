"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";

import { useChangePassword } from "@/features/settings/app/hooks/use-change-password";
import {
  changePasswordFormSchema,
  type ChangePasswordFormValues,
} from "@/features/settings/app/utils/schemas";
import { toast } from "@/lib/toast";
import { Form, FormPassword } from "@/shared/components/forms";
import { PasswordStrengthIndicator } from "@/shared/components/forms/password-strength-indicator";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

export function ChangePasswordCard() {
  const t = useTranslations("settings.password");
  const tStrength = useTranslations("clients.selfRegister.passwordStrength");
  const { submitChangePassword } = useChangePassword();
  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const newPassword = useWatch({ control: form.control, name: "newPassword" }) ?? "";
  const confirmPassword = useWatch({ control: form.control, name: "confirmPassword" }) ?? "";

  async function onSubmit(values: ChangePasswordFormValues) {
    try {
      await submitChangePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      toast.success(t("success"));
      form.reset();
    } catch {
      /* erro: toast global no apiClient */
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col">
          <CardContent className="space-y-4">
            <FormPassword name="currentPassword" label={t("current")} autoComplete="current-password" />
            <FormPassword name="newPassword" label={t("new")} autoComplete="new-password" />
            <FormPassword name="confirmPassword" label={t("confirm")} autoComplete="new-password" />
            <div className="bg-muted/30 border-border/80 space-y-3 rounded-xl border p-4 shadow-sm">
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                {tStrength("requirementsTitle")}
              </p>
              <PasswordStrengthIndicator
                password={newPassword}
                confirmPassword={confirmPassword}
                labelsNamespace="clients.selfRegister.passwordStrength"
                rulesTwoColumn
                className="space-y-0"
              />
            </div>
            <p className="text-muted-foreground text-xs">{t("hintNoPassword")}</p>
          </CardContent>
          <CardFooter className="mt-6 justify-end border-t pt-4">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              {t("submit")}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
