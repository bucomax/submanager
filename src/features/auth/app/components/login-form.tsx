"use client";

import { useTranslations } from "next-intl";
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
import { Form, FormInput, FormPassword } from "@/shared/components/forms";
import { ChevronRight, KeyRound } from "lucide-react";
import { useLoginForm } from "../hooks/use-login-form";

export function LoginForm() {
  const t = useTranslations("auth");
  const tGlobal = useTranslations("global");
  const { form, submitError, onSubmit } = useLoginForm();

  return (
    <div className="w-full">
      <header className="mb-8 text-center">
        <Link href="/" className="group inline-flex flex-col items-center gap-1">
          <span className="text-2xl font-semibold tracking-tight transition-opacity group-hover:opacity-80">
            {tGlobal("brand")}
          </span>
          <span className="text-muted-foreground text-sm">{t("login.brandLine")}</span>
        </Link>
      </header>
      <Card className="w-full border shadow-xl shadow-black/5 dark:shadow-black/20">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl">{t("login.title")}</CardTitle>
          <CardDescription>{t("login.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={onSubmit} className="flex flex-col gap-4 pb-4">
              <FormInput name="email" label={t("login.email")} type="email" autoComplete="email" />
              <FormPassword
                name="password"
                label={t("login.password")}
                autoComplete="current-password"
              />
              {submitError ? (
                <Alert variant="destructive">
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              ) : null}
              <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
                {form.formState.isSubmitting ? t("login.submitting") : t("login.submit")}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="border-border/60 bg-muted/35 p-0 dark:border-border/50 dark:bg-muted/20">
          <Link
            href="/auth/forgot-password"
            className="group flex w-full items-center gap-3 px-4 py-3.5 text-sm font-medium text-foreground/90 no-underline transition-[background-color,color,box-shadow] hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary shadow-sm ring-1 ring-primary/20 transition-[background-color,box-shadow,transform] group-hover:bg-primary/18 group-hover:ring-primary/30 group-hover:shadow-md dark:bg-primary/15 dark:ring-primary/25"
              aria-hidden
            >
              <KeyRound className="size-4" strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1 text-left leading-snug">
              {t("login.forgotPassword")}
              <span className="text-muted-foreground mt-0.5 block text-xs font-normal">
                {t("login.forgotPasswordHint")}
              </span>
            </span>
            <ChevronRight
              className="text-muted-foreground size-4 shrink-0 opacity-70 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100"
              aria-hidden
            />
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
