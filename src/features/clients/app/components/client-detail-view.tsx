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
import { ArrowLeft, RefreshCw } from "lucide-react";
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

  return (
    <div className="space-y-6">
      <ClientDetailHeader client={client} />

      <div className="columns-1 gap-6 [column-fill:balance] lg:columns-2 [&>*]:mb-6 [&>*]:break-inside-avoid">
        <ClientDetailProfileCard clientId={clientId} client={client} />
        <ClientDetailCaseNotesCard clientId={clientId} client={client} />
        <ClientDetailNotesCard clientId={clientId} />
        <ClientDetailFilesCard clientId={clientId} />

        {!pp ? (
          <ClientDetailStartPathwayCard
            clientId={client.id}
            hasCompletedHistory={(data.completedTreatments ?? []).length > 0}
          />
        ) : (
          <>
            <ClientDetailJourneyCard pp={pp} />
            {pp.completedAt ? null : <ClientDetailSwitchPathwayHint patientPathwayId={pp.id} />}
            <ClientDetailAssigneeSection pp={pp} />
            <ClientDetailNextActionsCard pp={pp} />
            <ClientDetailChecklistCard
              pp={pp}
              updatingChecklistItemId={updatingChecklistItemId}
              onToggle={(id, checked) => void handleChecklistToggle(id, checked)}
            />
            {pp.completedAt ? null : <ClientDetailTransitionCard pp={pp} transition={transition} />}
          </>
        )}

        <div className="mt-8 min-w-0 w-full [column-span:all]">
          <ClientDetailTimelineSection clientId={clientId} />
        </div>

        <div className="min-w-0 w-full [column-span:all]">
          <ClientCompletedTreatmentsSection client={client} items={data.completedTreatments ?? []} />
        </div>
      </div>
    </div>
  );
}
