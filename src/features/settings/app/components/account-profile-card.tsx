"use client";

import { useTranslatedZodResolver } from "@/shared/lib/forms/translated-zod-resolver";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { AccountProfileImageField } from "@/features/settings/app/components/account-profile-image-field";
import { useAccountProfile } from "@/features/settings/app/hooks/use-account-profile";
import {
  profileFormSchema,
  type ProfileFormValues,
} from "@/features/settings/app/utils/schemas";
import { toast } from "@/lib/toast";
import { Form, FormInput } from "@/shared/components/forms";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Field, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Skeleton } from "@/shared/components/ui/skeleton";

export function AccountProfileCard() {
  const t = useTranslations("settings.profile");
  const { profile, loading, error, reload, saveProfile } = useAccountProfile();

  const resolver = useTranslatedZodResolver<ProfileFormValues>(profileFormSchema);
  const form = useForm<ProfileFormValues>({
    resolver,
    defaultValues: { name: "", image: "" },
  });

  useEffect(() => {
    if (!profile) return;
    form.reset({
      name: profile.name ?? "",
      image: profile.image ?? "",
    });
  }, [form, profile]);

  async function onSubmit(values: ProfileFormValues) {
    try {
      await saveProfile({
        name: values.name.trim(),
        image: values.image === undefined || values.image.trim() === "" ? null : values.image.trim(),
      });
      toast.success(t("success"));
    } catch {
      await reload();
    }
  }

  if (loading && !profile && !error) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full max-w-md" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-destructive text-sm">{error}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
            <RefreshCw className="size-4" />
            {t("retry")}
          </Button>
        </CardContent>
      </Card>
    );
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
            <Field>
              <FieldLabel htmlFor="account-email">{t("email")}</FieldLabel>
              <Input id="account-email" readOnly value={profile?.email ?? ""} className="bg-muted/50" />
            </Field>
            <FormInput name="name" label={t("name")} autoComplete="name" />
            <AccountProfileImageField displayUrl={profile?.imageUrl ?? null} />
          </CardContent>
          <CardFooter className="mt-6 justify-end border-t pt-4">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {t("save")}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
