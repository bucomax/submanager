"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Form, FormInput, FormPassword } from "@/shared/components/forms";
import { ChevronRight, KeyRound } from "lucide-react";
import { useLoginForm } from "../hooks/use-login-form";

export function LoginForm() {
  const t = useTranslations("auth");
  const { form, submitError, onSubmit } = useLoginForm();

  return (
    <div className="flex w-full flex-col gap-7">
      <header className="flex flex-col gap-2.5">
        <span className="text-accent-foreground inline-flex items-center gap-2 text-xs font-semibold tracking-[0.14em] uppercase before:h-px before:w-[18px] before:bg-brand before:content-['']">
          {t("login.brandLine")}
        </span>
        <h1 className="text-foreground text-4xl leading-[1.05] font-extrabold tracking-[-0.035em]">{t("login.title")}</h1>
        <p className="text-muted-foreground">{t("login.description")}</p>
      </header>
      <Form {...form}>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <FormInput name="email" label={t("login.email")} type="email" autoComplete="email" />
          <FormPassword name="password" label={t("login.password")} autoComplete="current-password" />
          {submitError ? (
            <Alert variant="destructive">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" size="lg" disabled={form.formState.isSubmitting} className="mt-1 w-full">
            {form.formState.isSubmitting ? t("login.submitting") : t("login.submit")}
          </Button>
        </form>
      </Form>
      <Link
        href="/auth/forgot-password"
        className="group bg-muted hover:bg-accent flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-medium text-foreground no-underline transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className="bg-card text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-[10px]" aria-hidden>
          <KeyRound className="size-4" />
        </span>
        <span className="min-w-0 flex-1 text-left leading-snug">
          {t("login.forgotPassword")}
          <span className="text-muted-foreground mt-0.5 block text-xs font-normal">{t("login.forgotPasswordHint")}</span>
        </span>
        <ChevronRight className="text-muted-foreground size-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </div>
  );
}
