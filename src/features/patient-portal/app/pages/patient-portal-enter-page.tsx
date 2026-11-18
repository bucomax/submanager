"use client";

import { usePatientPortalTenantSlug } from "@/features/patient-portal/app/context/patient-portal-tenant-context";
import { PatientPortalFullScreenLoading } from "@/features/patient-portal/app/components/patient-portal-full-screen-loading";
import { useExchangePatientPortalToken } from "@/features/patient-portal/app/hooks/use-exchange-patient-portal-token";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function PatientPortalEnterPageInner() {
  const tenantSlug = usePatientPortalTenantSlug();
  const t = useTranslations("patientPortal");
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const { failed } = useExchangePatientPortalToken(tenantSlug, token, () =>
    router.replace(`/${tenantSlug}/patient`),
  );

  if (!token) {
    return (
      <Alert variant="destructive" className="max-w-md">
        <AlertDescription>{t("enter.error")}</AlertDescription>
      </Alert>
    );
  }

  if (failed) {
    return (
      <Alert variant="destructive" className="max-w-md">
        <AlertDescription>{t("enter.error")}</AlertDescription>
      </Alert>
    );
  }

  return <PatientPortalFullScreenLoading message={t("enter.validating")} showMessage={false} />;
}

export function PatientPortalEnterPage() {
  const t = useTranslations("patientPortal");
  return (
    <Suspense fallback={<PatientPortalFullScreenLoading message={t("enter.validating")} showMessage={false} />}>
      <PatientPortalEnterPageInner />
    </Suspense>
  );
}
