"use client";

import {
  CLIENTS_LIST_GRID_COLS,
  ClientsListRow,
} from "@/features/clients/app/components/clients-list-row";
import { ClientListDeleteDialog } from "@/features/clients/app/components/client-list-delete-dialog";
import { useClientsList } from "@/features/clients/app/hooks/use-clients-list";
import { useCopyPortalLink } from "@/features/clients/app/hooks/use-copy-portal-link";
import { LabeledSelect } from "@/shared/components/forms/labeled-select";
import {
  DataTableBody,
  DataTableEmpty,
  DataTableFilters,
  DataTableHeader,
  DataTablePagination,
  DataTableRoot,
  DataTableScroll,
} from "@/shared/components/layout/data-table";
import { Button } from "@/shared/components/ui/button";
import { Field, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { RefreshCw, Search, UsersRound, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

export function ClientsList() {
  const t = useTranslations("clients.list");
  const { data: session } = useSession();
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const { copyPortalLink, busyClientId } = useCopyPortalLink();

  const canDeletePatient =
    session?.user?.tenantRole === "tenant_admin" || session?.user?.globalRole === "super_admin";

  const {
    rows,
    total,
    page,
    from,
    to,
    canPrev,
    canNext,
    statusFilterCapped,
    listError,
    pathways,
    pathwaysError,
    stages,
    stagesError,
    stagesLoading,
    search,
    setSearch,
    pathwayFilter,
    setPathwayFilter,
    stageFilter,
    setStageFilter,
    statusFilter,
    setStatusFilter,
    retry,
    goPrev,
    goNext,
    loading,
    hasActiveSearch,
  } = useClientsList();

  const pathwayOptions = useMemo(() => {
    const base = [{ value: "all", label: t("filters.allPathways") }];
    if (!pathways?.length) return base;
    return [...base, ...pathways.map((p) => ({ value: p.id, label: p.name }))];
  }, [pathways, t]);

  const stageOptions = useMemo(() => {
    if (pathwayFilter === "all") {
      return [{ value: "all", label: t("filters.stageSelectPathwayFirst") }];
    }
    const base = [{ value: "all", label: t("filters.allStages") }];
    if (!stages?.length) return base;
    return [...base, ...stages.map((s) => ({ value: s.id, label: s.name }))];
  }, [pathwayFilter, stages, t]);

  const statusOptions = useMemo(
    () => [
      { value: "all", label: t("filters.allStatus") },
      { value: "ok", label: t("sla.ok") },
      { value: "warning", label: t("sla.warning") },
      { value: "danger", label: t("sla.danger") },
      { value: "completed", label: t("sla.completed") },
    ],
    [t],
  );

  const hasActiveFilters =
    hasActiveSearch || pathwayFilter !== "all" || stageFilter !== "all" || statusFilter !== "all";

  function clearFilters() {
    setSearch("");
    setPathwayFilter("all");
    setStageFilter("all");
    setStatusFilter("all");
  }

  if (loading && rows === null) {
    // Esqueleto no formato final: barra de filtros + linhas da tabela.
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-[92px] w-full rounded-[20px]" />
        <div className="bg-card space-y-3 rounded-[20px] border p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-3.5 w-1/4" />
              <Skeleton className="ml-auto h-6 w-28 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (listError) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-destructive text-sm">{listError}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void retry()}>
          <RefreshCw className="size-4 shrink-0" aria-hidden />
          {t("retry")}
        </Button>
      </div>
    );
  }

  const safeRows = rows ?? [];

  return (
    <div className="space-y-4">
      <ClientListDeleteDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        clientId={pendingDelete?.id ?? null}
        clientName={pendingDelete?.name ?? ""}
      />
      {pathwaysError ? <p className="text-destructive text-sm">{pathwaysError}</p> : null}
      {stagesError ? <p className="text-destructive text-sm">{stagesError}</p> : null}

      {/* ── Filtros ── */}
      <DataTableFilters className="w-full">
        <div className="grid w-full grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_auto]">
          <Field className="min-w-0">
            <FieldLabel htmlFor="clients-search">{t("search")}</FieldLabel>
            <div className="relative">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                aria-hidden
              />
              <Input
                id="clients-search"
                className="w-full pr-10 pl-9 [&::-webkit-search-cancel-button]:hidden"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchPlaceholder")}
                type="search"
                autoComplete="off"
              />
              {search ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground absolute top-1/2 right-1.5 -translate-y-1/2"
                  aria-label={t("filters.clearSearch")}
                  onClick={() => setSearch("")}
                >
                  <X aria-hidden />
                </Button>
              ) : null}
            </div>
          </Field>
          <LabeledSelect
            className="min-w-0"
            id="clients-filter-pathway"
            label={t("filters.pathway")}
            value={pathwayFilter}
            onValueChange={setPathwayFilter}
            options={pathwayOptions}
            disabled={pathways === null}
            placeholder={t("filters.pathwayPlaceholder")}
          />
          <LabeledSelect
            className="min-w-0"
            id="clients-filter-stage"
            label={t("filters.stage")}
            value={stageFilter}
            onValueChange={setStageFilter}
            options={stageOptions}
            disabled={pathwayFilter === "all" || stagesLoading}
            placeholder={
              pathwayFilter === "all"
                ? t("filters.stageSelectPathwayFirst")
                : t("filters.stagePlaceholder")
            }
          />
          <LabeledSelect
            className="min-w-0"
            id="clients-filter-status"
            label={t("filters.status")}
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={statusOptions}
          />
          {hasActiveFilters ? (
            <Button type="button" variant="ghost" className="sm:col-span-2 xl:col-span-1" onClick={clearFilters}>
              <X aria-hidden />
              {t("filters.clear")}
            </Button>
          ) : null}
        </div>
      </DataTableFilters>

      {statusFilterCapped ? (
        <p className="text-muted-foreground text-xs">{t("pagination.statusCappedHint")}</p>
      ) : null}

      {/* ── Tabela ── */}
      <DataTableRoot>
        <DataTableScroll>
          <DataTableHeader className={CLIENTS_LIST_GRID_COLS}>
            <span>{t("columns.name")}</span>
            <span>{t("columns.cpf")}</span>
            <span>{t("columns.pathway")}</span>
            <span>{t("columns.stage")}</span>
            <span>{t("columns.daysAndSla")}</span>
            <span className="min-w-0 whitespace-nowrap">{t("columns.updated")}</span>
            <span className="text-end">{t("columns.actions")}</span>
          </DataTableHeader>

          {!safeRows.length ? (
            <DataTableEmpty>
              <span className="flex flex-col items-center gap-3 py-4">
                <span className="bg-muted text-muted-foreground grid size-11 place-items-center rounded-xl" aria-hidden>
                  <UsersRound className="size-5" />
                </span>
                <span className="text-foreground font-semibold">
                  {hasActiveFilters ? t("noResults") : t("empty")}
                </span>
                {hasActiveFilters ? (
                  <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                    <X aria-hidden />
                    {t("filters.clear")}
                  </Button>
                ) : null}
              </span>
            </DataTableEmpty>
          ) : (
            <DataTableBody>
              {safeRows.map((c) => (
                <ClientsListRow
                  key={c.id}
                  client={c}
                  canDelete={canDeletePatient}
                  busyPortalLinkClientId={busyClientId}
                  onCopyPortalLink={(clientId) => void copyPortalLink(clientId)}
                  onDelete={setPendingDelete}
                />
              ))}
            </DataTableBody>
          )}
        </DataTableScroll>

        <DataTablePagination
          page={page}
          canPrev={canPrev}
          canNext={canNext}
          onPrev={goPrev}
          onNext={goNext}
          prevLabel={t("pagination.prev")}
          nextLabel={t("pagination.next")}
          rangeLabel={total === 0 ? t("pagination.emptyRange") : t("pagination.range", { from, to, total })}
        />
      </DataTableRoot>
    </div>
  );
}
