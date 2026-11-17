"use client";

import { JourneyStagesList } from "@/features/clients/app/components/client-detail-journey-stages-list";
import { useClientFileDownload } from "@/features/clients/app/hooks/use-client-file-download";
import type { ClientCompletedTreatmentDto, ClientDetailClientDto } from "@/types/api/clients-v1";
import { uniqueActors } from "@/features/clients/app/utils/treatments";
import { formatDateTime } from "@/lib/utils/date";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/shared/components/ui/card";
import { ClientDetailCardTitle } from "@/features/clients/app/components/client-detail-card-title";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  Archive,
  ChevronDown,
  CircleDot,
  ExternalLink,
  FileText,
  GitBranch,
  History,
  ListChecks,
  Loader2,
  UserRound,
  Users,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode } from "react";

function CompletedSectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <p className="text-foreground mb-2 flex items-center gap-2 text-sm font-medium">
      <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
      {children}
    </p>
  );
}

type ClientCompletedTreatmentsSectionProps = {
  client: ClientDetailClientDto;
  items: ClientCompletedTreatmentDto[];
  /** No portal do paciente o download de PDF da ficha antiga usa outra API — aqui só listamos nomes. */
  enableFileDownload?: boolean;
};

export function ClientCompletedTreatmentsSection({
  client,
  items,
  enableFileDownload = true,
}: ClientCompletedTreatmentsSectionProps) {
  const t = useTranslations("clients.detail.completedTreatments");
  const tHist = useTranslations("clients.detail.history");
  const tFiles = useTranslations("clients.detail.files");
  const locale = useLocale();
  const { downloadingId, openDownload } = useClientFileDownload();

  async function handleDownloadFile(fileId: string) {
    try {
      await openDownload(fileId);
    } catch {
      /* erro: toast global no apiClient */
    }
  }

  const intlLocale = locale === "en" ? "en-US" : "pt-BR";

  if (items.length === 0) return null;

  return (
    <Card className="border-dashed">
      <CardHeader>
        <ClientDetailCardTitle icon={Archive}>{t("title")}</ClientDetailCardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((ct) => {
          const actors = uniqueActors(ct.transitions);
          return (
            <details
              key={ct.id}
              className="group rounded-xl border bg-card shadow-sm open:shadow-md [&_summary::-webkit-details-marker]:hidden"
            >
              <summary
                className={cn(
                  "flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3 text-left",
                  "hover:bg-muted/40 rounded-xl transition-colors",
                )}
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="truncate text-sm font-semibold">{ct.pathway.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {t("summaryDates", {
                      start: formatDateTime(ct.startedAt, intlLocale),
                      end: formatDateTime(ct.completedAt, intlLocale),
                    })}
                  </p>
                </div>
                <ChevronDown className="text-muted-foreground size-5 shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-border space-y-5 border-t px-4 py-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border bg-muted/20 px-3 py-2.5 text-sm">
                    <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
                      <CircleDot className="size-3.5 shrink-0" aria-hidden />
                      {t("finalStage")}
                    </p>
                    <p className="mt-1 font-medium">{ct.currentStage?.name ?? "—"}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 px-3 py-2.5 text-sm">
                    <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
                      <UserRound className="size-3.5 shrink-0" aria-hidden />
                      {t("assigneeTitle")}
                    </p>
                    <p className="mt-1 font-medium">
                      {client.assignedTo?.name ?? client.assignedTo?.email ?? "—"}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">{t("assigneeHint")}</p>
                  </div>
                </div>

                {actors.length > 0 ? (
                  <div>
                    <CompletedSectionTitle icon={Users}>{t("teamFromTransitions")}</CompletedSectionTitle>
                    <ul className="flex flex-wrap gap-2">
                      {actors.map((a, idx) => (
                        <li
                          key={`${a.email}-${idx}`}
                          className="bg-muted/50 text-foreground inline-flex rounded-md border px-2 py-1 text-xs"
                        >
                          {a.name ?? a.email}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div>
                  <CompletedSectionTitle icon={GitBranch}>{t("stagesTitle")}</CompletedSectionTitle>
                  <JourneyStagesList
                    stages={ct.pathwayVersion.stages}
                    current={ct.currentStage ?? null}
                    journeyCompleted
                  />
                </div>

                <div>
                  <CompletedSectionTitle icon={FileText}>{t("documentsTitle")}</CompletedSectionTitle>
                  {ct.pathwayVersion.stages.every((s) => s.documents.length === 0) ? (
                    <p className="text-muted-foreground text-sm">{t("documentsEmpty")}</p>
                  ) : (
                    <ul className="space-y-3 text-sm">
                      {ct.pathwayVersion.stages.map((stage) => {
                        if (stage.documents.length === 0) return null;
                        return (
                          <li key={stage.id} className="rounded-lg border bg-muted/10 px-3 py-2">
                            <p className="text-muted-foreground text-xs font-medium">{stage.name}</p>
                            <ul className="mt-2 space-y-2">
                              {stage.documents.map((d) => (
                                <li
                                  key={d.id}
                                  className="flex flex-wrap items-center justify-between gap-2 border-border/60 border-b pb-2 last:border-0 last:pb-0"
                                >
                                  <span className="min-w-0 flex-1 truncate">
                                    <span className="font-medium">{d.file.fileName}</span>
                                  </span>
                                  {enableFileDownload ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon-sm"
                                      className="h-8 w-8 shrink-0"
                                      disabled={downloadingId === d.file.id}
                                      aria-label={tFiles("openAria")}
                                      onClick={() => void handleDownloadFile(d.file.id)}
                                    >
                                      {downloadingId === d.file.id ? (
                                        <Loader2 className="size-4 animate-spin" aria-hidden />
                                      ) : (
                                        <ExternalLink className="size-4" aria-hidden />
                                      )}
                                    </Button>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div>
                  <CompletedSectionTitle icon={ListChecks}>{t("checklistTitle")}</CompletedSectionTitle>
                  {ct.pathwayVersion.stages.every((s) => s.checklistItems.length === 0) ? (
                    <p className="text-muted-foreground text-sm">{t("checklistEmpty")}</p>
                  ) : (
                    <div className="space-y-4">
                      {ct.pathwayVersion.stages.map((stage) => {
                        if (stage.checklistItems.length === 0) return null;
                        return (
                          <div key={stage.id}>
                            <p className="text-muted-foreground mb-1.5 text-xs font-medium">{stage.name}</p>
                            <ul className="space-y-1.5 rounded-lg border bg-muted/10 p-2">
                              {stage.checklistItems.map((item) => (
                                <li key={item.id} className="text-sm">
                                  <span className={item.completed ? "text-muted-foreground line-through" : ""}>
                                    {item.label}
                                  </span>
                                  {item.completedAt ? (
                                    <span className="text-muted-foreground ml-2 text-xs">
                                      ({formatDateTime(item.completedAt, intlLocale)})
                                    </span>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <CompletedSectionTitle icon={History}>{t("historyTitle")}</CompletedSectionTitle>
                  {ct.transitions.length === 0 ? (
                    <p className="text-muted-foreground text-sm">{t("noTransitions")}</p>
                  ) : (
                    <ul className="divide-border divide-y text-sm">
                      {ct.transitions.map((tr) => (
                        <li key={tr.id} className="flex flex-col gap-1 py-2.5">
                          <span className="font-medium">
                            {tr.fromStage?.name ?? tHist("start")} → {tr.toStage.name}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {formatDateTime(tr.createdAt, intlLocale)} · {tr.actor.name ?? tr.actor.email}
                            {tr.note ? ` · ${tr.note}` : ""}
                            {tr.ruleOverrideReason
                              ? ` · ${tHist("overrideSummary", {
                                  reason: tr.ruleOverrideReason,
                                  by: tr.forcedBy?.name?.trim() || tr.forcedBy?.email || "—",
                                })}`
                              : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {ct.transitionsTruncated ? (
                    <p className="text-muted-foreground mt-2 text-xs">{t("transitionsTruncated")}</p>
                  ) : null}
                </div>
              </div>
            </details>
          );
        })}
      </CardContent>
    </Card>
  );
}
