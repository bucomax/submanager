import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { AuthSuspenseFallback } from "../components/auth-suspense-fallback";
import { SetPasswordForm } from "../components/set-password-form";

export async function ResetPasswordPage() {
  const t = await getTranslations("auth.setPassword");

  return (
    <Suspense fallback={<AuthSuspenseFallback />}>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{t("resetTitle")}</CardTitle>
          <CardDescription>{t("resetDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <SetPasswordForm successMessage={t("successReset")} />
        </CardContent>
      </Card>
    </Suspense>
  );
}
