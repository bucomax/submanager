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
import { InviteSetPasswordShell } from "../components/invite-set-password-shell";

export async function InviteSetPasswordPage() {
  const t = await getTranslations("auth.setPassword");

  return (
    <Suspense fallback={<AuthSuspenseFallback />}>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{t("inviteTitle")}</CardTitle>
          <CardDescription>{t("inviteDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <InviteSetPasswordShell successMessage={t("successInvite")} />
        </CardContent>
      </Card>
    </Suspense>
  );
}
