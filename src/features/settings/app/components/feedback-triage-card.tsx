"use client";

import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  DataTableBody,
  DataTableEmpty,
  DataTableHeader,
  DataTablePagination,
  DataTableRoot,
  DataTableRow,
  DataTableScroll,
} from "@/shared/components/layout/data-table";
import { useFeedbackTriage } from "@/features/settings/app/hooks/use-feedback-triage";
import type { FeedbackStatus, FeedbackType } from "@/types/api/feedback-v1";

const SENTRY_ISSUE_BASE = "https://sentry.io/organizations/tercon/issues/?query=";

/** `as const` preserva o literal de cada chave para bater com `NamespacedMessageKeys`. */
const STATUS_KEYS = {
  open: "statusOpen",
  triaged: "statusTriaged",
  in_progress: "statusInProgress",
  resolved: "statusResolved",
  wont_fix: "statusWontFix",
  duplicate: "statusDuplicate",
} as const satisfies Record<FeedbackStatus, string>;

const STATUS_VALUES = Object.keys(STATUS_KEYS) as FeedbackStatus[];

const TYPE_KEYS = {
  bug: "typeBug",
  suggestion: "typeSuggestion",
  question: "typeQuestion",
  other: "typeOther",
} as const satisfies Record<FeedbackType, string>;

const TYPE_VALUES = Object.keys(TYPE_KEYS) as FeedbackType[];

/** Valor sentinela do Select: Radix não aceita item com `value=""`. */
const FILTER_ALL = "all";

/** `DataTable*` é baseado em div/ul/li, não em `<table>` — daí o grid. */
const GRID = "grid grid-cols-[6rem_minmax(0,1fr)_12rem_7rem_10rem] items-start gap-3";

export function FeedbackTriageCard() {
  const t = useTranslations("settings.feedback");
  const {
    rows,
    pagination,
    loading,
    pendingId,
    filters,
    setPage,
    setStatusFilter,
    setTypeFilter,
    changeStatus,
  } = useFeedbackTriage();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-xs" htmlFor="feedback-filter-status">
              {t("filterStatusLabel")}
            </label>
            <Select
              value={filters.status ?? FILTER_ALL}
              onValueChange={(value) =>
                setStatusFilter(value === FILTER_ALL ? undefined : (value as FeedbackStatus))
              }
            >
              <SelectTrigger id="feedback-filter-status" className="h-8 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>{t("filterAllStatuses")}</SelectItem>
                {STATUS_VALUES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(STATUS_KEYS[value])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-xs" htmlFor="feedback-filter-type">
              {t("filterTypeLabel")}
            </label>
            <Select
              value={filters.type ?? FILTER_ALL}
              onValueChange={(value) =>
                setTypeFilter(value === FILTER_ALL ? undefined : (value as FeedbackType))
              }
            >
              <SelectTrigger id="feedback-filter-type" className="h-8 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>{t("filterAllTypes")}</SelectItem>
                {TYPE_VALUES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(TYPE_KEYS[value])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DataTableRoot>
          <DataTableScroll>
            <DataTableHeader className={GRID}>
              <span>{t("columnType")}</span>
              <span>{t("columnMessage")}</span>
              <span>{t("columnAuthor")}</span>
              <span>{t("columnError")}</span>
              <span>{t("columnStatus")}</span>
            </DataTableHeader>

            {rows.length === 0 && !loading ? (
              <DataTableEmpty>{t("empty")}</DataTableEmpty>
            ) : (
              <DataTableBody>
                {rows.map((row) => (
                  <DataTableRow key={row.id} className={GRID}>
                    <Badge variant="outline">{t(TYPE_KEYS[row.type])}</Badge>

                    <div className="min-w-0">
                      <p className="line-clamp-3">{row.message}</p>
                      <p className="text-muted-foreground text-xs">{row.pagePath}</p>
                    </div>

                    <span className="truncate">{row.author?.email ?? "—"}</span>

                    {row.sentryEventId ? (
                      <a
                        href={`${SENTRY_ISSUE_BASE}${row.sentryEventId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary inline-flex items-center gap-1 font-mono text-xs hover:underline"
                      >
                        {row.sentryEventId.slice(0, 8)}
                        <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}

                    <Select
                      value={row.status}
                      onValueChange={(value) =>
                        void changeStatus(row.id, value as FeedbackStatus)
                      }
                      disabled={pendingId === row.id}
                    >
                      <SelectTrigger aria-label={t("statusAria")} className="h-8">
                        {/* `SelectValue` sem children mostra o `value` cru — precisa do label traduzido. */}
                        <SelectValue>{t(STATUS_KEYS[row.status])}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_VALUES.map((value) => (
                          <SelectItem key={value} value={value}>
                            {t(STATUS_KEYS[value])}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </DataTableRow>
                ))}
              </DataTableBody>
            )}

            {pagination && pagination.totalPages > 1 ? (
              <DataTablePagination
                page={pagination.page}
                canPrev={pagination.hasPreviousPage}
                canNext={pagination.hasNextPage}
                onPrev={() => setPage(pagination.page - 1)}
                onNext={() => setPage(pagination.page + 1)}
                prevLabel={t("prevPage")}
                nextLabel={t("nextPage")}
                rangeLabel={t("rangeLabel", { count: pagination.totalItems })}
              />
            ) : null}
          </DataTableScroll>
        </DataTableRoot>
      </CardContent>
    </Card>
  );
}
