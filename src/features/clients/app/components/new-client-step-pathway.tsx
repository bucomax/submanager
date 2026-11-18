"use client";

import type { PathwayOption } from "@/features/clients/app/types/api";
import { Field, FieldDescription, FieldLabel } from "@/shared/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

type NewClientPathwayStepProps = {
  eligiblePathways: PathwayOption[];
  loading: boolean;
  error: string | null;
  pathwayId: string | null;
  onPathwayChange: (pathwayId: string | null) => void;
};

/** Etapa 2: escolha do fluxo (apenas fluxos com versão publicada). */
export function NewClientPathwayStep({
  eligiblePathways,
  loading: pathwaysLoading,
  error: pathwaysError,
  pathwayId,
  onPathwayChange,
}: NewClientPathwayStepProps) {
  const t = useTranslations("clients.wizard");
  return (
      <div className="space-y-3">
        {pathwaysLoading ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            {t("pathwayLoading")}
          </div>
        ) : null}
        {pathwaysError ? (
          <p className="text-destructive text-sm">{pathwaysError}</p>
        ) : null}
        {!pathwaysLoading && eligiblePathways.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("pathwayEmpty")}</p>
        ) : null}
        {!pathwaysLoading && eligiblePathways.length > 0 ? (
          <Field>
            <FieldLabel>{t("pathwayLabel")}</FieldLabel>
            <FieldDescription>{t("pathwayHelp")}</FieldDescription>
            <Select
              value={pathwayId ?? undefined}
              onValueChange={(v) => onPathwayChange(v ?? null)}
            >
              <SelectTrigger className="w-full max-w-md" size="default">
                <SelectValue placeholder={t("pathwayPlaceholder")}>
                  {(value) => {
                    if (value == null) return t("pathwayPlaceholder");
                    const p = eligiblePathways.find((x) => x.id === value);
                    if (!p) return value;
                    return (
                      <>
                        {p.name}
                        {p.publishedVersion ? ` · v${p.publishedVersion.version}` : ""}
                      </>
                    );
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {eligiblePathways.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {p.publishedVersion ? ` · v${p.publishedVersion.version}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
      </div>
  );
}
