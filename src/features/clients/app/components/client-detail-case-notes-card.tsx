"use client";

import { ClientDetailCardTitle } from "@/features/clients/app/components/client-detail-card-title";
import { useClientCaseNotes } from "@/features/clients/app/hooks/use-client-case-notes";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/shared/components/ui/card";
import { Field, FieldLabel } from "@/shared/components/ui/field";
import type { ClientDetailClientDto } from "@/types/api/clients-v1";
import { FileText, Loader2, Save } from "lucide-react";
import { useTranslations } from "next-intl";

type ClientDetailCaseNotesCardProps = {
  clientId: string;
  client: ClientDetailClientDto;
};

export function ClientDetailCaseNotesCard({ clientId, client }: ClientDetailCaseNotesCardProps) {
  const t = useTranslations("clients.detail");
  const { draft, setDraft, dirty, saving, save } = useClientCaseNotes(clientId, client);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <ClientDetailCardTitle icon={FileText}>{t("caseNotes.title")}</ClientDetailCardTitle>
        <CardDescription>{t("caseNotes.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Field>
          <FieldLabel htmlFor="client-case-description">{t("caseNotes.label")}</FieldLabel>
          <textarea
            id="client-case-description"
            rows={5}
            maxLength={20_000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={saving}
            className={cn(
              "border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-[4.5rem] w-full rounded-lg border px-2.5 py-2 text-base transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
            )}
          />
        </Field>
        <Button type="button" size="sm" disabled={!dirty || saving} onClick={() => void save()}>
          {saving ? (
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <Save className="size-4 shrink-0" aria-hidden />
          )}
          {saving ? t("caseNotes.saving") : t("caseNotes.save")}
        </Button>
      </CardContent>
    </Card>
  );
}
