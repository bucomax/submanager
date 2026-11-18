"use client";

import { ClientDetailCardTitle } from "@/features/clients/app/components/client-detail-card-title";
import { useClientAuditExport } from "@/features/clients/app/hooks/use-client-audit-export";
import { useClientTimeline } from "@/features/clients/app/hooks/use-client-timeline";
import { lineForItem } from "@/features/clients/app/utils/timeline-line";
import { CLIENT_TIMELINE_EVENT_CATEGORIES } from "@/domain/audit/event-category-mapper";
import {
  AuditTimelineList,
  TimelineCategoryIcon,
  timelineCategoryFilterChipCn,
  timelineCategoryIconClassForActiveFilter,
} from "@/shared/components/timeline/audit-timeline-list";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  History,
  Info,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

type ClientDetailTimelineSectionProps = {
  clientId: string;
};

export function ClientDetailTimelineSection({ clientId }: ClientDetailTimelineSectionProps) {
  const t = useTranslations("clients.detail");
  const { data: session } = useSession();
  const { exporting, downloadAuditExport } = useClientAuditExport(clientId);
  const canExportAudit =
    session?.user?.tenantRole === "tenant_admin" || session?.user?.globalRole === "super_admin";
  const {
    data,
    error,
    loading,
    page,
    setPage,
    reload,
    limit,
    selectedCategories,
    toggleCategory,
    selectAllCategories,
  } = useClientTimeline(clientId);

  const pag = data?.pagination;
  const from =
    pag && pag.totalItems === 0 ? 0 : pag ? (page - 1) * limit + 1 : 0;
  const to =
    pag && pag.totalItems === 0 ? 0 : pag ? Math.min(page * limit, pag.totalItems) : 0;

  if (loading && !data) {
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-6 w-48" />
            {canExportAudit ? <Skeleton className="h-9 w-44 shrink-0" /> : null}
          </div>
          <Skeleton className="h-4 w-full max-w-md" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <ClientDetailCardTitle icon={History}>{t("timeline.title")}</ClientDetailCardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-destructive text-sm">{error ?? t("timeline.loadError")}</p>
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => void reload()}>
            <RefreshCw className="size-4" />
            {t("retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const emptyMessage =
    pag && pag.totalItems > 0 ? t("timeline.noRows") : t("timeline.empty");

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <ClientDetailCardTitle icon={History}>{t("timeline.title")}</ClientDetailCardTitle>
          {canExportAudit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={exporting}
              onClick={() => void downloadAuditExport()}
            >
              {exporting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
              {t("timeline.exportCsv")}
            </Button>
          ) : null}
        </div>
        <CardDescription className="space-y-1">
          <p>{t("timeline.description")}</p>
          {data.timelineCapped ? (
            <p className="text-warning text-xs">{t("timeline.cappedHint")}</p>
          ) : null}
          {pag && pag.totalItems > 0 ? (
            <p>{t("timeline.range", { from, to, total: pag.totalItems })}</p>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/25 border-border/60 space-y-3 rounded-xl border p-3 sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-2.5">
              <span className="bg-background text-muted-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border shadow-sm">
                <Filter className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 space-y-1">
                <p className="text-foreground text-sm font-medium leading-snug">{t("timeline.filtersLabel")}</p>
                <p className="text-muted-foreground text-xs leading-relaxed">{t("timeline.filtersHint")}</p>
              </div>
            </div>
            {selectedCategories.size < CLIENT_TIMELINE_EVENT_CATEGORIES.length ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 shrink-0 self-start text-xs font-medium"
                onClick={selectAllCategories}
              >
                {t("timeline.filtersShowAll")}
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {CLIENT_TIMELINE_EVENT_CATEGORIES.map((cat) => {
              const active = selectedCategories.has(cat);
              const onlyOneLeft = active && selectedCategories.size === 1;
              return (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={active}
                  disabled={onlyOneLeft}
                  title={onlyOneLeft ? t("timeline.filtersKeepOneHint") : undefined}
                  onClick={() => toggleCategory(cat)}
                  className={timelineCategoryFilterChipCn(cat, active, onlyOneLeft)}
                >
                  <TimelineCategoryIcon
                    category={cat}
                    className={active ? timelineCategoryIconClassForActiveFilter(cat) : undefined}
                  />
                  <span className="min-w-0 break-words">{t(`timeline.categories.${cat}`)}</span>
                </button>
              );
            })}
          </div>
        </div>
        {data.items.length === 0 ? (
          <Alert variant="info">
            <Info className="size-4" aria-hidden />
            <AlertDescription>{emptyMessage}</AlertDescription>
          </Alert>
        ) : (
          <AuditTimelineList
            rows={data.items.map((item) => {
              const { title, subtitle } = lineForItem(
                item,
                t as unknown as (key: string, values?: Record<string, string | number>) => string,
              );
              return {
                id: `${item.kind}:${item.id}`,
                category: item.category,
                title,
                subtitle,
              };
            })}
          />
        )}
        {pag && pag.totalPages > 1 ? (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!pag.hasPreviousPage || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-4" />
              {t("timeline.prev")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!pag.hasNextPage || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              {t("timeline.next")}
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
