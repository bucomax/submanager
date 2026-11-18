"use client";

import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";

import { AgendaMonthGrid } from "@/features/agenda/app/components/agenda-month-grid";
import { AgendaUpcomingList } from "@/features/agenda/app/components/agenda-upcoming-list";
import { AgendaWeekGrid } from "@/features/agenda/app/components/agenda-week-grid";
import { useAgendaEvents } from "@/features/agenda/app/hooks/use-agenda-events";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { AlertTriangle, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

export function AgendaPage() {
  const t = useTranslations("agenda");
  const locale = useLocale();
  const router = useRouter();
  const { mode, setMode, from, events, loading, error, refresh, goToday, goPrevious, goNext } = useAgendaEvents();

  const titleFormatter = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pt-BR", {
    month: "long",
    year: "numeric",
  });
  const title = titleFormatter.format(from);

  return (
    <div className="bg-card flex h-[calc(100dvh-8.5rem)] min-h-0 overflow-hidden rounded-[20px] border">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-3 border-b px-5 py-4">
          <h1 className="text-foreground text-2xl font-extrabold tracking-[-0.03em] capitalize">{title}</h1>
          <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums">
            {t("count", { count: events.length })}
          </span>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* Kit: segmento Semana / Mês. */}
            <div className="bg-muted flex items-center gap-0.5 rounded-xl p-[3px]" role="group">
              {(["semana", "mes"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={cn(
                    "flex h-8 items-center rounded-[9px] px-3.5 text-[13px] font-semibold transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    mode === m ? "bg-card text-foreground shadow-s1" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(`view.${m === "semana" ? "week" : "month"}`)}
                </button>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={goToday}>
              {t("view.today")}
            </Button>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button type="button" variant="outline" size="icon-sm" onClick={goPrevious} aria-label={t("view.previous")}>
                    <ChevronLeft aria-hidden />
                  </Button>
                }
              />
              <TooltipContent>{t("view.previous")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button type="button" variant="outline" size="icon-sm" onClick={goNext} aria-label={t("view.next")}>
                    <ChevronRight aria-hidden />
                  </Button>
                }
              />
              <TooltipContent>{t("view.next")}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-3">
          {loading ? (
            <div className="grid h-full grid-cols-7 gap-2" aria-busy="true">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-full min-h-64 rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <span className="bg-destructive-soft text-destructive grid size-11 place-items-center rounded-xl" aria-hidden>
                <AlertTriangle className="size-5" />
              </span>
              <p className="text-muted-foreground text-sm">{t("loadError")}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
                <RefreshCw aria-hidden />
                {t("retry")}
              </Button>
            </div>
          ) : mode === "semana" ? (
            <AgendaWeekGrid
              weekStart={from}
              events={events}
              onEventClick={(event) =>
                event.conversationId && router.push(`/dashboard/contacts/${event.conversationId}`)
              }
            />
          ) : (
            <AgendaMonthGrid
              monthStart={from}
              events={events}
              onEventClick={(event) =>
                event.conversationId && router.push(`/dashboard/contacts/${event.conversationId}`)
              }
            />
          )}
        </div>
      </div>

      <AgendaUpcomingList events={events} />
    </div>
  );
}
