"use client";

import { useClientPathwayOptions } from "@/features/clients/app/hooks/use-client-pathway-options";
import { createPatientPathway } from "@/features/clients/app/services/clients.service";
import { ClientDetailCardTitle } from "@/features/clients/app/components/client-detail-card-title";
import { toast } from "@/lib/toast";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/shared/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/shared/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Info, Loader2, MapPinned, PlayCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

/** Valor sentinela do Select (sempre controlado — evita alternar uncontrolled/controlled). */
const PATHWAY_SELECT_NONE = "__none__";

type ClientDetailStartPathwayCardProps = {
  clientId: string;
  hasCompletedHistory: boolean;
  onStarted: () => void;
};

export function ClientDetailStartPathwayCard({
  clientId,
  hasCompletedHistory,
  onStarted,
}: ClientDetailStartPathwayCardProps) {
  const t = useTranslations("clients.detail");
  const tw = useTranslations("clients.wizard");
  const [pathwayId, setPathwayId] = useState<string>(PATHWAY_SELECT_NONE);
  const [submitting, setSubmitting] = useState(false);
  const { eligiblePathways, loading, error, reload } = useClientPathwayOptions({
    enabled: true,
    fallbackErrorMessage: tw("errorGeneric"),
  });

  useEffect(() => {
    if (loading || eligiblePathways.length !== 1) return;
    setPathwayId((prev) => (prev === PATHWAY_SELECT_NONE ? eligiblePathways[0]!.id : prev));
  }, [loading, eligiblePathways]);

  async function handleStart() {
    if (!pathwayId || pathwayId === PATHWAY_SELECT_NONE) {
      toast.error(t("startPathway.pickPathway"));
      return;
    }
    setSubmitting(true);
    try {
      await createPatientPathway({ clientId, pathwayId });
      toast.success(t("startPathway.success"));
      onStarted();
    } catch {
      /* erro: toast global no apiClient */
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="min-w-0">
      <CardHeader>
        <ClientDetailCardTitle icon={MapPinned}>{t("noPathway.title")}</ClientDetailCardTitle>
        <CardDescription>{t("noPathway.sectionDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="info">
          <Info className="size-4 shrink-0" aria-hidden />
          <AlertDescription className="text-sm leading-snug">
            {hasCompletedHistory ? t("noPathway.emptyWithHistory") : t("noPathway.empty")}
          </AlertDescription>
        </Alert>
        {loading ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {tw("pathwayLoading")}
          </div>
        ) : null}
        {error ? (
          <div className="space-y-2">
            <p className="text-destructive text-sm">{error}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
              {t("retry")}
            </Button>
          </div>
        ) : null}
        {!loading && eligiblePathways.length === 0 ? (
          <p className="text-muted-foreground text-sm">{tw("pathwayEmpty")}</p>
        ) : null}
        {!loading && eligiblePathways.length > 0 ? (
          <Field>
            <FieldLabel>{tw("pathwayLabel")}</FieldLabel>
            <FieldDescription>{tw("pathwayHelp")}</FieldDescription>
            <Select
              value={pathwayId}
              onValueChange={(v) => setPathwayId(v ?? PATHWAY_SELECT_NONE)}
              disabled={submitting}
            >
              <SelectTrigger className="w-full min-w-0">
                <SelectValue placeholder={tw("pathwayPlaceholder")}>
                  {(value) => {
                    if (value == null || value === PATHWAY_SELECT_NONE) {
                      return tw("pathwayPlaceholder");
                    }
                    return eligiblePathways.find((p) => p.id === value)?.name ?? value;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PATHWAY_SELECT_NONE}>{tw("pathwayPlaceholder")}</SelectItem>
                {eligiblePathways.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        {!loading && eligiblePathways.length > 0 ? (
          <Button
            type="button"
            size="sm"
            disabled={submitting || pathwayId === PATHWAY_SELECT_NONE}
            onClick={() => void handleStart()}
          >
            {submitting ? (
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <PlayCircle className="size-4 shrink-0" aria-hidden />
            )}
            {submitting ? t("startPathway.submitting") : t("startPathway.submit")}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
