"use client";

import type { DashboardPipelineOpmeOption, PipelineStatusFilter } from "@/features/dashboard/app/types";
import { KANBAN_OPME_QUERY_UNASSIGNED } from "@/lib/pathway/kanban-client-where";
import { LabeledSelect } from "@/shared/components/forms/labeled-select";
import { Field, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

type PipelineFiltersBarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: PipelineStatusFilter;
  onStatusFilterChange: (value: PipelineStatusFilter) => void;
  opmeSupplierId: string;
  onOpmeSupplierIdChange: (value: string) => void;
  opmeOptions: DashboardPipelineOpmeOption[];
  hasActiveFilters: boolean;
  onClearFilters: () => void;
};

export function PipelineFiltersBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  opmeSupplierId,
  onOpmeSupplierIdChange,
  opmeOptions,
  hasActiveFilters,
  onClearFilters,
}: PipelineFiltersBarProps) {
  const t = useTranslations("dashboard.pipeline");

  const statusOptions = useMemo(
    () => [
      { value: "all", label: t("filters.all") },
      { value: "ok", label: t("stats.ok") },
      { value: "warning", label: t("stats.warning") },
      { value: "danger", label: t("stats.danger") },
    ],
    [t],
  );

  const opmeSelectOptions = useMemo(() => {
    const base = [
      { value: "all", label: t("filters.opmeAll") },
      { value: KANBAN_OPME_QUERY_UNASSIGNED, label: t("filters.opmeUnassigned") },
    ];
    return [
      ...base,
      ...opmeOptions.map((o) => ({ value: o.value, label: o.label })),
    ];
  }, [opmeOptions, t]);

  const statusValue = statusFilter === "" ? "all" : statusFilter;
  const opmeValue =
    opmeSupplierId === "" ? "all" : opmeSupplierId;

  return (
    <div className="rounded-[20px] border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden />
        <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{t("filters.title")}</span>
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <Field className="min-w-[220px] flex-1">
          <FieldLabel htmlFor="dash-search">{t("filters.search")}</FieldLabel>
          <Input
            id="dash-search"
            placeholder={t("filters.searchPlaceholder")}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </Field>
        <LabeledSelect
          className="w-full sm:w-48"
          label={t("filters.status")}
          value={statusValue}
          onValueChange={(v) => onStatusFilterChange(!v || v === "all" ? "" : (v as PipelineStatusFilter))}
          options={statusOptions}
        />
        <LabeledSelect
          className="w-full min-w-[200px] sm:w-56"
          label={t("filters.opme")}
          value={opmeValue}
          onValueChange={(v) => onOpmeSupplierIdChange(!v || v === "all" ? "" : v)}
          options={opmeSelectOptions}
        />
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="text-muted-foreground hover:text-foreground h-10 px-1 text-sm"
          >
            {t("filters.clear")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
