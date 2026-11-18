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
import { useLogoutPatientPortal } from "@/features/patient-portal/app/hooks/use-patient-portal-session";
import { usePatientPortalTimeline } from "@/features/patient-portal/app/hooks/use-patient-portal-timeline";
import { usePatientPortalTenantSlug } from "@/features/patient-portal/app/context/patient-portal-tenant-context";
import { PatientPortalLoginPage } from "@/features/patient-portal/app/pages/patient-portal-login-page";
import { PatientPortalFilesSection } from "@/features/patient-portal/app/components/patient-portal-files-section";
import { PatientPortalTimelineSection } from "@/features/patient-portal/app/components/patient-portal-timeline-section";
import { PatientPortalFullScreenLoading } from "@/features/patient-portal/app/components/patient-portal-full-screen-loading";
import { PatientPortalPasswordDialog } from "@/features/patient-portal/app/components/patient-portal-password-dialog";
import { formatDateTime } from "@/lib/utils/date";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Card, CardDescription, CardHeader } from "@/shared/components/ui/card";
import { Info, KeyRound, LogOut, MapPinned } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function PatientPortalHomePage() {
  const tenantSlug = usePatientPortalTenantSlug();
  const t = useTranslations("patientPortal");
  const td = useTranslations("clients.detail");
  const { data, error, loading, needsLink, reload } = usePatientPortalClientDetail(tenantSlug);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const {
    timeline,
    loading: timelineLoading,
    error: timelineError,
    goToPage: loadTimelinePage,
  } = usePatientPortalTimeline(tenantSlug, data?.client.id ?? null);

  const { logout } = useLogoutPatientPortal();

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
      />
      <div className="animate-enter flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-foreground text-3xl leading-[1.05] font-extrabold tracking-[-0.035em]">
            {t("home.welcome", { name: client.name })}
          </h1>
          <p className="text-muted-foreground text-sm">{t("home.clinic", { clinic: data.tenant.name })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setPasswordDialogOpen(true)}>
            <KeyRound aria-hidden />
            {t("home.passwordAction")}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => void logout()}>
            <LogOut aria-hidden />
            {t("home.logout")}
          </Button>
        </div>
      </div>

      {/* Kit (portal): jornada primeiro, depois documentos e linha do tempo; dados pessoais por último. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
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
              <ClientDetailNextActionsCard pp={pp} />
              <ClientDetailChecklistCard pp={pp} readOnly />
              <ClientDetailAssigneeSection pp={pp} />
            </>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <PatientPortalFilesSection formatDateTime={(iso) => formatDateTime(iso)} onAfterUpload={() => loadTimelinePage(1)} />
          <PatientPortalTimelineSection
            timeline={timeline}
            loading={timelineLoading}
            error={timelineError}
            onPageChange={loadTimelinePage}
            formatDateTime={(iso) => formatDateTime(iso)}
          />
        </div>
      </div>

      <ClientDetailProfileCard clientId={client.id} client={client} variant="patient" tenantSlug={tenantSlug} />

      <div className="min-w-0 w-full">
        <ClientCompletedTreatmentsSection
          client={client}
          items={completedTreatments}
          enableFileDownload={false}
        />
      </div>

      <Alert variant="info">
        <Info className="size-4" aria-hidden />
        <AlertDescription className="text-sm">{t("home.readOnlyJourneyHint")}</AlertDescription>
      </Alert>
    </div>
  );
}
