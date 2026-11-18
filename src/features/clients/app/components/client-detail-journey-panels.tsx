"use client";

import { ClientDetailAssigneeOverviewCard } from "@/features/clients/app/components/client-detail-assignee-overview-card";
import { ClientDetailCardTitle } from "@/features/clients/app/components/client-detail-card-title";
import { JourneyStagesList } from "@/features/clients/app/components/client-detail-journey-stages-list";
import { formatDateTime } from "@/lib/utils/date";
import type { SlaHealthStatus } from "@/domain/pathway/sla-health";
import { slaHealthPillClassName } from "@/lib/utils/sla-status-ui";
import type { ClientPatientPathwayDetailDto } from "@/types/api/clients-v1";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader } from "@/shared/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CheckCircle2, ClipboardList, GitBranch, Info, ListChecks, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

function SlaPill({ status, label }: { status: SlaHealthStatus; label: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${slaHealthPillClassName(status)}`}>
      {label}
    </span>
  );
}

export function ClientDetailJourneyCard({ pp }: { pp: ClientPatientPathwayDetailDto }) {
  const t = useTranslations("clients.detail");
  const locale = useLocale();
  const slaLabel = (status: SlaHealthStatus) =>
    status === "ok" ? t("sla.ok") : status === "warning" ? t("sla.warning") : t("sla.danger");

  return (
    <Card className="min-w-0">
      <CardHeader>
        <ClientDetailCardTitle icon={GitBranch}>{t("journey.title")}</ClientDetailCardTitle>
        <CardDescription>{pp.pathway.name}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pp.completedAt ? (
          <Alert variant="info">
            <Info className="size-4" aria-hidden />
            <AlertDescription>
              {t("journey.completedBanner", {
                date: formatDateTime(pp.completedAt, locale === "en" ? "en-US" : "pt-BR"),
              })}
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="bg-muted/25 flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 text-sm">
          <span className="text-muted-foreground">{t("journey.currentStage")}</span>
          <span className="font-medium">{pp.completedAt ? "—" : (pp.currentStage?.name ?? "—")}</span>
          {pp.completedAt ? null : (
            <>
              <span className="text-muted-foreground">{t("journey.daysInStage", { days: pp.daysInStage })}</span>
              <SlaPill status={pp.slaStatus} label={slaLabel(pp.slaStatus)} />
            </>
          )}
        </div>
        <JourneyStagesList
          stages={pp.pathwayVersion.stages}
          current={pp.currentStage ?? null}
          journeyCompleted={pp.completedAt != null}
        />
      </CardContent>
    </Card>
  );
}

export function ClientDetailAssigneeSection({
  pp,
}: {
  pp: ClientPatientPathwayDetailDto;
}) {
  return (
    <ClientDetailAssigneeOverviewCard overview={pp.assigneeOverview} currentStageAssignee={pp.currentStageAssignee} />
  );
}

export function ClientDetailNextActionsCard({ pp }: { pp: ClientPatientPathwayDetailDto }) {
  const t = useTranslations("clients.detail");
  const slaLabel = (status: SlaHealthStatus) =>
    status === "ok" ? t("sla.ok") : status === "warning" ? t("sla.warning") : t("sla.danger");

  const incompleteRequiredChecklist = useMemo(() => {
    const items = pp.currentStage?.checklistItems ?? [];
    return items.filter((item) => item.requiredForTransition && !item.completed);
  }, [pp.currentStage?.checklistItems]);

  if (pp.completedAt) {
    return null;
  }

  return (
    <Card className="min-w-0">
      <CardHeader className="pb-3">
        <p id="next-actions-summary-desc" className="sr-only">
          {t("nextActions.description")}
        </p>
        <div className="flex items-start justify-between gap-3">
          <ClientDetailCardTitle icon={ClipboardList} className="min-w-0 flex-1">
            {t("nextActions.title")}
          </ClientDetailCardTitle>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className="text-muted-foreground hover:bg-muted/60 hover:text-foreground mt-0.5 shrink-0 rounded-md p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={t("nextActions.helpAria")}
                  aria-describedby="next-actions-summary-desc"
                >
                  <Info className="size-4" aria-hidden />
                </button>
              }
            />
            <TooltipContent side="bottom" align="end" className="max-w-sm text-left text-sm">
              {t("nextActions.description")}
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="bg-muted/20 border-border/60 flex flex-col gap-3 rounded-lg border px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-muted-foreground text-xs font-medium">{t("journey.currentStage")}</p>
            <p className="text-foreground truncate text-base leading-tight font-semibold">
              {pp.currentStage?.name ?? "—"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:shrink-0 sm:justify-end">
            <SlaPill status={pp.slaStatus} label={slaLabel(pp.slaStatus)} />
            <span className="text-muted-foreground text-sm tabular-nums">
              {t("journey.daysInStage", { days: pp.daysInStage })}
            </span>
          </div>
        </div>

        {pp.currentStage?.patientMessage?.trim() ? (
          <div className="border-border/70 bg-muted/10 rounded-lg border px-3 py-3">
            <p className="text-muted-foreground mb-2 text-xs font-medium">{t("nextActions.stageMessage")}</p>
            <p className="text-foreground/95 text-sm leading-relaxed whitespace-pre-wrap">
              {pp.currentStage.patientMessage}
            </p>
          </div>
        ) : null}

        {incompleteRequiredChecklist.length > 0 ? (
          <Alert variant="destructive" className="border-destructive/40">
            <Info className="size-4 shrink-0" aria-hidden />
            <AlertDescription>
              <p className="font-medium">{t("nextActions.pendingRequiredTitle")}</p>
              <ul className="mt-2 list-inside list-disc space-y-0.5">
                {incompleteRequiredChecklist.map((item) => (
                  <li key={item.id}>{item.label}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="border-success/25 bg-success/[0.06] flex items-start gap-2.5 rounded-lg border px-3 py-2.5">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            <p className="text-muted-foreground text-sm leading-snug">{t("nextActions.noBlockingChecklist")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type ClientDetailChecklistCardProps = {
  pp: ClientPatientPathwayDetailDto;
  readOnly?: boolean;
  updatingChecklistItemId?: string | null;
  onToggle?: (checklistItemId: string, completed: boolean) => void;
};

export function ClientDetailChecklistCard({
  pp,
  readOnly = false,
  updatingChecklistItemId = null,
  onToggle,
}: ClientDetailChecklistCardProps) {
  const t = useTranslations("clients.detail");
  const currentStageChecklist = pp.currentStage?.checklistItems ?? [];
  const completedChecklistCount = currentStageChecklist.filter((item) => item.completed).length;
  const checklistTotal = currentStageChecklist.length;
  const checklistProgressPercent =
    checklistTotal === 0 ? 0 : Math.round((completedChecklistCount / checklistTotal) * 100);
  const pathwayLocked = pp.completedAt != null || readOnly;

  return (
    <Card className="min-w-0">
      <CardHeader>
        <ClientDetailCardTitle icon={ListChecks}>{t("checklist.title")}</ClientDetailCardTitle>
        <CardDescription>
          {pp.completedAt
            ? t("journey.readOnlyHint")
            : pp.currentStage
              ? t("checklist.description", { stage: pp.currentStage.name })
              : t("checklist.descriptionEmpty")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pp.currentStage && checklistTotal > 0 ? (
          <div
            className="border-border/70 bg-muted/15 rounded-xl border px-3 py-3"
            role="group"
            aria-label={t("checklist.progressLabel")}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground text-xs font-medium tracking-tight">
                {t("checklist.progressLabel")}
              </span>
              <span
                className="bg-background/80 text-foreground tabular-nums ring-border/80 rounded-md px-2 py-0.5 text-sm font-semibold ring-1"
                title={t("checklist.progress", {
                  completed: completedChecklistCount,
                  total: checklistTotal,
                })}
              >
                {completedChecklistCount}/{checklistTotal}
              </span>
            </div>
            <div
              className="bg-muted mt-2.5 h-2 overflow-hidden rounded-full"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={checklistTotal}
              aria-valuenow={completedChecklistCount}
              aria-label={t("checklist.progress", {
                completed: completedChecklistCount,
                total: checklistTotal,
              })}
            >
              <div
                className="bg-primary h-full rounded-full transition-[width] duration-300 ease-out"
                style={{ width: `${checklistProgressPercent}%` }}
              />
            </div>
            <p className="text-muted-foreground mt-2 text-xs leading-snug" aria-hidden>
              {t("checklist.progress", {
                completed: completedChecklistCount,
                total: checklistTotal,
              })}
            </p>
          </div>
        ) : null}
        {currentStageChecklist.length === 0 ? (
          <Alert variant="info">
            <Info className="size-4" aria-hidden />
            <AlertDescription>
              {pp.currentStage ? t("checklist.empty") : t("checklist.descriptionEmpty")}
            </AlertDescription>
          </Alert>
        ) : (
          <ul className="space-y-2">
            {currentStageChecklist.map((item) => {
              const isUpdating = updatingChecklistItemId === item.id;
              return (
                <li key={item.id}>
                  <label
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 text-sm",
                      pathwayLocked ? "cursor-default" : "cursor-pointer",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={item.completed}
                      disabled={isUpdating || pathwayLocked || !onToggle}
                      onChange={(e) => onToggle?.(item.id, e.target.checked)}
                      className="mt-0.5 size-4"
                    />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block", item.completed && "text-muted-foreground line-through")}>
                        {item.label}
                        {item.requiredForTransition ? (
                          <span className="text-muted-foreground ml-2 align-middle text-[10px] font-normal uppercase tracking-wide">
                            ({t("checklist.requiredBadge")})
                          </span>
                        ) : null}
                      </span>
                      {item.completedAt ? (
                        <span className="text-muted-foreground mt-1 block text-xs">
                          {t("checklist.completedAt", {
                            date: formatDateTime(item.completedAt),
                          })}
                        </span>
                      ) : null}
                    </span>
                    {isUpdating ? <Loader2 className="text-muted-foreground size-4 animate-spin" /> : null}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
