"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PathwayStagesColumnEditor } from "@/features/pathways/app/components/pathway-stages-column-editor";
import { usePathways } from "@/features/pathways/app/hooks/use-pathways";
import { Link } from "@/i18n/navigation";
import { Button } from "@/shared/components/ui/button";
import { GitBranch, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Field, FieldLabel } from "@/shared/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/lib/utils";

type PathwayStagesSettingsPanelProps = {
  /** Ex.: `mt-0` quando a seção já define espaçamento (layout de Configurações). */
  className?: string;
};

export function PathwayStagesSettingsPanel({ className }: PathwayStagesSettingsPanelProps) {
  const t = useTranslations("pathways.columnEditor");
  const tList = useTranslations("pathways.list");
  const { pathways, loading } = usePathways();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /** Sempre string quando há pathways — evita Select alternar entre não controlado (`undefined`) e controlado. */
  const effectivePathwayId =
    pathways && pathways.length > 0 ? (selectedId ?? pathways[0]!.id) : null;

  /** Base UI Select: sem `items` no Root, o trigger mostra o value cru (ex.: cuid). */
  const pathwaySelectItems = useMemo(() => {
    if (!pathways?.length) return undefined;
    return Object.fromEntries(pathways.map((p) => [p.id, p.name])) as Record<string, string>;
  }, [pathways]);

  return (
    <Card className={cn("mt-8", className)}>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pb-8">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full max-w-md rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        ) : !pathways?.length ? (
          <div className="text-muted-foreground space-y-3 text-sm">
            <p>{t("noPathways")}</p>
            <Button nativeButton={false} variant="outline" size="sm" render={<Link href="/dashboard/pathways" />}>
              <GitBranch className="size-4" />
              {t("goToPathways")}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
              <Field className="min-w-0 flex-1 sm:max-w-md">
                <FieldLabel htmlFor="settings-pathway-select">{t("selectPathway")}</FieldLabel>
                <Select
                  value={effectivePathwayId!}
                  onValueChange={(v) => setSelectedId(v)}
                  items={pathwaySelectItems}
                >
                  <SelectTrigger id="settings-pathway-select" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pathways.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Button
                nativeButton={false}
                variant="outline"
                size="sm"
                className="w-full shrink-0 sm:w-auto"
                render={<Link href="/dashboard/pathways" />}
              >
                <Plus className="size-4" />
                {tList("newPathway")}
              </Button>
            </div>
            {effectivePathwayId ? (
              <div className="border-border/55 mt-2 space-y-4 border-t pt-8">
                <PathwayStagesColumnEditor key={effectivePathwayId} pathwayId={effectivePathwayId} />
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
