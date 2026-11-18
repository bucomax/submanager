"use client";

import { ClientCompletedTreatmentsSection } from "@/features/clients/app/components/client-completed-treatments-section";
import { ClientDetailCaseNotesCard } from "@/features/clients/app/components/client-detail-case-notes-card";
import { ClientDetailFilesCard } from "@/features/clients/app/components/client-detail-files-card";
import { ClientDetailHeader } from "@/features/clients/app/components/client-detail-header";
import {
  ClientDetailAssigneeSection,
  ClientDetailChecklistCard,
  ClientDetailJourneyCard,
  ClientDetailNextActionsCard,
} from "@/features/clients/app/components/client-detail-journey-panels";
import { ClientDetailNotesCard } from "@/features/clients/app/components/client-detail-notes-card";
import { ClientDetailProfileCard } from "@/features/clients/app/components/client-detail-profile-card";
import { ClientDetailStartPathwayCard } from "@/features/clients/app/components/client-detail-start-pathway-card";
import { ClientDetailSwitchPathwayHint } from "@/features/clients/app/components/client-detail-switch-pathway-hint";
import { ClientDetailTimelineSection } from "@/features/clients/app/components/client-detail-timeline-section";
import { ClientDetailTransitionCard } from "@/features/clients/app/components/client-detail-transition-card";
import { useClientDetail } from "@/features/clients/app/hooks/use-client-detail";
import { useClientPathwayActions } from "@/features/clients/app/hooks/use-client-pathway-actions";
import { useClientStageTransition } from "@/features/clients/app/hooks/use-client-stage-transition";
import { Link } from "@/i18n/navigation";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { ArrowLeft, CheckCircle2, FileText, GitBranch, History, NotebookPen, RefreshCw, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";

type ClientDetailViewProps = {
  clientId: string;
};

export function ClientDetailView({ clientId }: ClientDetailViewProps) {
  const t = useTranslations("clients.detail");
  const { data, error, loading, reload } = useClientDetail(clientId);
  const { updatingChecklistItemId, toggleChecklistItem } = useClientPathwayActions();
  const pp = data?.patientPathway;
  const transition = useClientStageTransition(pp);

  async function handleChecklistToggle(checklistItemId: string, completed: boolean) {
    if (!pp) return;
    try {
      await toggleChecklistItem(pp.id, checklistItemId, completed);
    } catch {
      /* erro: toast global no apiClient */
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-2/3 max-w-md" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-destructive text-sm">{error ?? t("loadError")}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
          <RefreshCw className="size-4" />
          {t("retry")}
        </Button>
        <Button
          nativeButton={false}
          variant="link"
          size="sm"
          className="w-fit px-0"
          render={<Link href="/dashboard/clients" />}
        >
          <ArrowLeft className="size-4" />
          {t("backToList")}
        </Button>
      </div>
    );
  }

  const { client } = data;
  const completedTreatments = data.completedTreatments ?? [];

  // Kit: a ficha em abas no lugar da página longa. Todas as abas ficam montadas (keepMounted),
  // então formulários em edição e carregamentos seguem como antes ao trocar de aba.
  return (
    <div className="space-y-6">
      <ClientDetailHeader client={client} />

      <Tabs defaultValue="journey">
        <TabsList aria-label={t("tabs.ariaLabel")}>
          <TabsTrigger value="journey">
            <GitBranch aria-hidden />
            {t("tabs.journey")}
          </TabsTrigger>
          <TabsTrigger value="profile">
            <UserRound aria-hidden />
            {t("tabs.profile")}
          </TabsTrigger>
          <TabsTrigger value="files">
            <FileText aria-hidden />
            {t("tabs.files")}
          </TabsTrigger>
          <TabsTrigger value="notes">
            <NotebookPen aria-hidden />
            {t("tabs.notes")}
          </TabsTrigger>
          <TabsTrigger value="timeline">
            <History aria-hidden />
            {t("tabs.timeline")}
          </TabsTrigger>
          {completedTreatments.length > 0 ? (
            <TabsTrigger value="completed">
              <CheckCircle2 aria-hidden />
              {t("tabs.completed")}
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="journey">
          {!pp ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start">
              <ClientDetailStartPathwayCard clientId={client.id} hasCompletedHistory={completedTreatments.length > 0} />
              <ClientDetailCaseNotesCard clientId={clientId} client={client} />
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start">
              <div className="flex min-w-0 flex-col gap-6">
                <ClientDetailJourneyCard pp={pp} />
                {pp.completedAt ? null : <ClientDetailTransitionCard pp={pp} transition={transition} />}
                <ClientDetailChecklistCard
                  pp={pp}
                  updatingChecklistItemId={updatingChecklistItemId}
                  onToggle={(id, checked) => void handleChecklistToggle(id, checked)}
                />
                <ClientDetailNextActionsCard pp={pp} />
              </div>
              <div className="flex min-w-0 flex-col gap-6">
                <ClientDetailAssigneeSection pp={pp} />
                <ClientDetailCaseNotesCard clientId={clientId} client={client} />
                {pp.completedAt ? null : <ClientDetailSwitchPathwayHint patientPathwayId={pp.id} />}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="profile">
          <ClientDetailProfileCard clientId={clientId} client={client} />
        </TabsContent>

        <TabsContent value="files">
          <ClientDetailFilesCard clientId={clientId} />
        </TabsContent>

        <TabsContent value="notes">
          <ClientDetailNotesCard clientId={clientId} />
        </TabsContent>

        <TabsContent value="timeline">
          <ClientDetailTimelineSection clientId={clientId} />
        </TabsContent>

        {completedTreatments.length > 0 ? (
          <TabsContent value="completed">
            <ClientCompletedTreatmentsSection client={client} items={completedTreatments} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
