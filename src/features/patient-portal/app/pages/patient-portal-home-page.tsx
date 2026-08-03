"use client";

import { ClientCompletedTreatmentsSection } from "@/features/clients/app/components/client-completed-treatments-section";
import { ClientDetailCardTitle } from "@/features/clients/app/components/client-detail-card-title";
import {
  ClientDetailAssigneeSection,
  ClientDetailChecklistCard,
  ClientDetailJourneyCard,
  ClientDetailNextActionsCard,
} from "@/features/clients/app/components/client-detail-journey-panels";
import { ClientDetailProfileCard } from "@/features/clients/app/components/client-detail-profile-card";
import { usePatientPortalClientDetail } from "@/features/patient-portal/app/hooks/use-patient-portal-client-detail";
import { usePatientPortalTimeline } from "@/features/patient-portal/app/hooks/use-patient-portal-timeline";
import { usePatientPortalTenantSlug } from "@/features/patient-portal/app/context/patient-portal-tenant-context";
import { PatientPortalLoginPage } from "@/features/patient-portal/app/pages/patient-portal-login-page";
import { PatientPortalFilesSection } from "@/features/patient-portal/app/components/patient-portal-files-section";
import { PatientPortalTimelineSection } from "@/features/patient-portal/app/components/patient-portal-timeline-section";
import { PatientPortalFullScreenLoading } from "@/features/patient-portal/app/components/patient-portal-full-screen-loading";
import { PatientPortalPasswordDialog } from "@/features/patient-portal/app/components/patient-portal-password-dialog";
import { logoutPatientPortal } from "@/lib/api/patient-portal-client";
import { formatDateTime } from "@/lib/utils/date";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Card, CardDescription, CardHeader } from "@/shared/components/ui/card";
import { Info, KeyRound, MapPinned } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function PatientPortalHomePage() {
  const tenantSlug = usePatientPortalTenantSlug();
  const t = useTranslations("patientPortal");
  const td = useTranslations("clients.detail");
  const { data, error, loading, needsLink, reload } = usePatientPortalClientDetail(tenantSlug);
  const [timelineRefresh, setTimelineRefresh] = useState(0);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const {
    timeline,
    loading: timelineLoading,
    error: timelineError,
    goToPage: loadTimelinePage,
  } = usePatientPortalTimeline(tenantSlug, data?.client.id ?? null, timelineRefresh);

  async function onLogout() {
    await logoutPatientPortal();
    reload();
  }

  /** Primeira carga da sessão: tela de loading unificada (evita flash do formulário de login). */
  if (!data && !error && loading) {
    return <PatientPortalFullScreenLoading message={t("home.sessionLoading")} showMessage={false} />;
  }

  /** Sem sessão: mesmo formulário de `/patient/login`. */
  if (!data && !error && needsLink) {
    return <PatientPortalLoginPage />;
  }

  if (error || !data) {
    return (
      <div className="max-w-md space-y-4">
        <p className="text-muted-foreground text-sm">{error ?? t("home.loadError")}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => reload()}>
          {t("home.retry")}
        </Button>
      </div>
    );
  }

  const { client, patientPathway: pp, completedTreatments = [], hasPortalPassword } = data;

  return (
    <div className="mx-auto flex w-full flex-col gap-6">
      <PatientPortalPasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        tenantSlug={tenantSlug}
        hasPortalPassword={hasPortalPassword}
        onSuccess={() => {
          reload();
          setTimelineRefresh((n) => n + 1);
        }}
      />
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("home.welcome", { name: client.name })}</h1>
          <p className="text-muted-foreground text-sm">{t("home.clinic", { clinic: data.tenant.name })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setPasswordDialogOpen(true)}
          >
            <KeyRound className="size-3.5" aria-hidden />
            {t("home.passwordAction")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void onLogout()}>
            {t("home.logout")}
          </Button>
        </div>
      </div>

      <div className="columns-1 gap-6 [column-fill:balance] lg:columns-2 [&>*]:mb-6 [&>*]:break-inside-avoid">
        <ClientDetailProfileCard
          clientId={client.id}
          client={client}
          variant="patient"
          tenantSlug={tenantSlug}
          onSaved={() => {
            reload();
            setTimelineRefresh((n) => n + 1);
          }}
        />

        {!pp ? (
          <Card className="min-w-0">
            <CardHeader>
              <ClientDetailCardTitle icon={MapPinned}>{td("noPathway.title")}</ClientDetailCardTitle>
              <CardDescription>
                {completedTreatments.length > 0
                  ? td("noPathway.portalCardDescriptionWithHistory")
                  : td("noPathway.portalCardDescription")}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <ClientDetailJourneyCard pp={pp} />
            <ClientDetailAssigneeSection pp={pp} />
            <ClientDetailNextActionsCard pp={pp} />
            <ClientDetailChecklistCard pp={pp} readOnly />
          </>
        )}

        <PatientPortalTimelineSection
          timeline={timeline}
          loading={timelineLoading}
          error={timelineError}
          onPageChange={loadTimelinePage}
          formatDateTime={(iso) => formatDateTime(iso)}
        />

        <PatientPortalFilesSection formatDateTime={(iso) => formatDateTime(iso)} onAfterUpload={() => loadTimelinePage(1)} />
      </div>

      <div className="[column-span:all] min-w-0 w-full">
        <ClientCompletedTreatmentsSection
          client={client}
          items={completedTreatments}
          enableFileDownload={false}
        />
      </div>

      <Alert variant="info" className="[column-span:all]">
        <Info className="size-4" aria-hidden />
        <AlertDescription className="text-sm">{t("home.readOnlyJourneyHint")}</AlertDescription>
      </Alert>
    </div>
  );
}
