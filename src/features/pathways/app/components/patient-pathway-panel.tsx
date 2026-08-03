"use client";

import { usePatientPathway } from "@/features/pathways/app/hooks/use-patient-pathway";
import type {
  PatientPathwayPanelProps,
  PatientPathwayTransitionCardProps,
} from "@/features/pathways/app/types/components";
import { toast } from "@/lib/toast";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Field, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function PatientPathwayPanel({ patientPathwayId }: PatientPathwayPanelProps) {
  const t = useTranslations("pathways.patient");
  const { data, loading, error, submitting, reload, submitTransition, nextOptions } =
    usePatientPathway(patientPathwayId);

  if (loading && !data && !error) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-destructive text-sm">{error ?? t("loadError")}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  return (
    // A `key` remonta o card ao trocar de paciente ou de etapa atual, zerando o
    // formulário sem precisar de um efeito de reset.
    <PatientPathwayTransitionCard
      key={`${data.id}:${data.currentStage?.id ?? ""}`}
      data={data}
      nextOptions={nextOptions}
      submitting={submitting}
      submitTransition={submitTransition}
    />
  );
}

function PatientPathwayTransitionCard({
  data,
  nextOptions,
  submitting,
  submitTransition,
}: PatientPathwayTransitionCardProps) {
  const t = useTranslations("pathways.patient");
  const [toStageId, setToStageId] = useState<string>("");
  const [note, setNote] = useState("");

  async function handleSubmit() {
    if (!toStageId) {
      toast.error(t("toStagePlaceholder"));
      return;
    }
    if (toStageId === data.currentStage?.id) {
      toast.error(t("sameStage"));
      return;
    }
    try {
      await submitTransition({
        toStageId,
        note: note.trim() || undefined,
      });
      toast.success(t("success"));
    } catch {
      /* erro: toast global no apiClient */
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <span className="text-muted-foreground">{t("client")}: </span>
          <span className="font-medium">{data.client.name}</span>
        </div>
        <div>
          <span className="text-muted-foreground">{t("pathway")}: </span>
          <span className="font-medium">{data.pathway.name}</span>
        </div>
        <div>
          <span className="text-muted-foreground">{t("currentStage")}: </span>
          <span className="font-medium">{data.currentStage?.name ?? "—"}</span>
        </div>
        <Field>
          <FieldLabel>{t("toStage")}</FieldLabel>
          <Select value={toStageId || undefined} onValueChange={(v) => setToStageId(v ?? "")}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder={t("toStagePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {nextOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="transition-note">{t("note")}</FieldLabel>
          <Input
            id="transition-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="—"
          />
        </Field>
      </CardContent>
      <CardFooter className="justify-end border-t">
        <Button type="button" onClick={() => void handleSubmit()} disabled={submitting || nextOptions.length === 0}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {t("submit")}
        </Button>
      </CardFooter>
    </Card>
  );
}
