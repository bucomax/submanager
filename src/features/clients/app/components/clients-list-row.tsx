"use client";

import { ListStageDaysSlaChip } from "@/features/clients/app/components/client-list-stage-sla-chip";
import type { ClientListItemDto } from "@/features/clients/app/types/api";
import { Link } from "@/i18n/navigation";
import { formatListUpdatedAt } from "@/lib/utils/format-list-updated-at";
import { formatCpfDisplay } from "@/lib/validators/cpf";
import { DataTableRow } from "@/shared/components/layout/data-table";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { GitBranch, Link2, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

/** Grade compartilhada entre cabeçalho e linhas da tabela de pacientes. */
export const CLIENTS_LIST_GRID_COLS =
  "grid min-w-[760px] grid-cols-[minmax(9rem,1.35fr)_minmax(8rem,0.95fr)_minmax(9rem,1.15fr)_minmax(7.5rem,1fr)_minmax(8rem,1.2fr)_minmax(6.5rem,0.68fr)_minmax(7rem,0.85fr)] items-center gap-3";

/** Duas iniciais para o avatar da linha (nome e sobrenome). */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

type ClientsListRowProps = {
  client: ClientListItemDto;
  canDelete: boolean;
  busyPortalLinkClientId: string | null;
  onCopyPortalLink: (clientId: string) => void;
  onDelete: (client: { id: string; name: string }) => void;
};

export function ClientsListRow({
  client: c,
  canDelete,
  busyPortalLinkClientId: busyClientId,
  onCopyPortalLink,
  onDelete,
}: ClientsListRowProps) {
  const t = useTranslations("clients.list");
  const locale = useLocale();
  const updatedAtLabel = formatListUpdatedAt(c.updatedAt, locale);
  const GRID_COLS = CLIENTS_LIST_GRID_COLS;

  return (
    <DataTableRow className={GRID_COLS}>
      <Link
        href={`/dashboard/clients/${c.id}`}
        className="group/name flex min-w-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          aria-hidden
          className="bg-avatar text-accent-foreground grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-bold"
        >
          {initialsOf(c.name)}
        </span>
        <span className="text-foreground min-w-0 truncate font-semibold group-hover/name:underline group-hover/name:underline-offset-4">
          {c.name}
        </span>
        {c.isMinor ? (
          <Badge variant="info" className="h-5 shrink-0 px-2 text-[11px]">
            {t("minorBadge")}
          </Badge>
        ) : null}
      </Link>
      <span className="text-muted-foreground min-w-0 truncate tabular-nums">
        {c.documentId ? formatCpfDisplay(c.documentId) : "—"}
      </span>
      <span className="min-w-0 truncate">
        {c.patientPathwayId && c.pathwayName ? (
          <Button
            nativeButton={false}
            size="sm"
            variant="link"
            className="h-auto min-w-0 max-w-full gap-1 px-0"
            render={<Link href={`/dashboard/patient-pathways/${c.patientPathwayId}`} />}
          >
            <GitBranch className="size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">{c.pathwayName}</span>
          </Button>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </span>
      <span className="text-muted-foreground min-w-0 truncate">
        {c.journeyCompletedAt ? "—" : (c.currentStageName ?? "—")}
      </span>
      <span className="min-w-0">
        <ListStageDaysSlaChip
          pathwayId={c.pathwayId}
          patientPathwayId={c.patientPathwayId}
          daysInStage={c.daysInStage}
          slaStatus={c.slaStatus}
          journeyCompletedAt={c.journeyCompletedAt ?? null}
        />
      </span>
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="text-muted-foreground inline-flex min-w-0 max-w-full cursor-default justify-end text-xs tabular-nums outline-none">
              <span className="min-w-0 truncate">{updatedAtLabel}</span>
            </span>
          }
        />
        <TooltipContent side="top" align="end" className="max-w-sm text-left">
          {t("updatedTooltip", { at: updatedAtLabel })}
        </TooltipContent>
      </Tooltip>
      <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="inline-flex">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t("actions.portalLinkAria")}
                  disabled={busyClientId !== null}
                  onClick={() => onCopyPortalLink(c.id)}
                >
                  {busyClientId === c.id ? (
                    <RefreshCw className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Link2 className="size-4" aria-hidden />
                  )}
                </Button>
              </span>
            }
          />
          <TooltipContent side="top">{t("actions.portalLink")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="inline-flex">
                <Button
                  nativeButton={false}
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t("actions.editAria")}
                  render={<Link href={`/dashboard/clients/${c.id}`} />}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
              </span>
            }
          />
          <TooltipContent side="top">{t("actions.edit")}</TooltipContent>
        </Tooltip>
        {canDelete ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="inline-flex">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive-soft hover:text-destructive"
                    aria-label={t("actions.deleteAria")}
                    onClick={() => onDelete({ id: c.id, name: c.name })}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </span>
              }
            />
            <TooltipContent side="top">{t("actions.delete")}</TooltipContent>
          </Tooltip>
        ) : null}
      </span>
    </DataTableRow>
  );
}
