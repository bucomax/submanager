"use client";

import type { DashboardAlertRow } from "@/features/dashboard/app/types";
import { Link } from "@/i18n/navigation";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { ExternalLink, Siren } from "lucide-react";
import { useTranslations } from "next-intl";

type PipelineAlertsCardProps = {
  alerts: DashboardAlertRow[];
};

export function PipelineAlertsCard({ alerts }: PipelineAlertsCardProps) {
  const t = useTranslations("dashboard.pipeline");

  if (alerts.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Siren className="size-4 text-destructive" aria-hidden />
          {t("alerts.title")}
        </CardTitle>
        <CardDescription>{t("alerts.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map((a) => (
          <div
            key={a.patientPathwayId}
            className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm">
              <span className="font-medium">{a.clientName}</span> —{" "}
              {t("alerts.stagnation", { days: a.daysInStage, stage: a.stageName })}
            </p>
            <Button
              nativeButton={false}
              variant="outline"
              size="sm"
              render={<Link href={`/dashboard/clients/${a.clientId}`} />}
            >
              <ExternalLink className="size-3.5" />
              {t("alerts.viewPatient")}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
