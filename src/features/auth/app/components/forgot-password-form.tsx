"use client";

import { Link } from "@/i18n/navigation";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Form, FormInput } from "@/shared/components/forms";
import { ChevronLeft, Mail, MailCheck, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForgotPasswordForm } from "../hooks/use-forgot-password-form";

export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgotPassword");
  const tLogin = useTranslations("auth.login");
  const tGlobal = useTranslations("global");
  const { form, message, apiError, onSubmit } = useForgotPasswordForm();

  return (
    <div className="w-full">
      <header className="mb-8 text-center">
        <Link href="/" className="group inline-flex flex-col items-center gap-1">
          <span className="text-2xl font-semibold tracking-tight transition-opacity group-hover:opacity-80">
            {tGlobal("brand")}
          </span>
          <span className="text-muted-foreground text-sm">{tLogin("brandLine")}</span>
        </Link>
      </header>

      <Card className="w-full border shadow-xl shadow-black/5 dark:shadow-black/20">
        <CardHeader className="space-y-4 pb-4">
          <div className="flex gap-3 sm:gap-4">
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary shadow-sm ring-1 ring-primary/20 dark:bg-primary/15 dark:ring-primary/25"
              aria-hidden
            >
              <Mail className="size-5" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <CardTitle className="text-xl leading-tight">{t("title")}</CardTitle>
              <CardDescription className="text-pretty leading-relaxed">{t("description")}</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <FormInput name="email" label={tLogin("email")} type="email" autoComplete="email" />
              {apiError ? (
                <Alert variant="destructive">
                  <ShieldAlert className="size-4 shrink-0" />
                  <AlertDescription>{apiError}</AlertDescription>
                </Alert>
              ) : null}
              {message ? (
                <Alert variant="info">
                  <MailCheck className="size-4 shrink-0" />
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              ) : null}
              <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
                {form.formState.isSubmitting ? t("submitting") : t("submit")}
              </Button>
            </form>
          </Form>
        </CardContent>

        <CardFooter className="border-border/60 bg-muted/35 p-0 dark:border-border/50 dark:bg-muted/20">
          <Link
            href="/login"
            className="group flex w-full items-center gap-3 px-4 py-3.5 text-sm font-medium text-foreground/90 no-underline transition-[background-color,color,box-shadow] hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground/80 shadow-sm ring-1 ring-border/60 transition-[background-color,box-shadow] group-hover:bg-background group-hover:ring-border"
              aria-hidden
            >
              <ChevronLeft className="size-4" strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1 text-left leading-snug">
              {t("backToLogin")}
              <span className="text-muted-foreground mt-0.5 block text-xs font-normal">{t("backToLoginHint")}</span>
            </span>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
