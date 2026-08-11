"use client";

import { AgendaMonthGrid } from "@/features/agenda/app/components/agenda-month-grid";
import { AgendaUpcomingList } from "@/features/agenda/app/components/agenda-upcoming-list";
import { AgendaWeekGrid } from "@/features/agenda/app/components/agenda-week-grid";
import { useAgendaEvents } from "@/features/agenda/app/hooks/use-agenda-events";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
    <div className="flex h-[calc(100vh-8rem)] min-h-0 overflow-hidden rounded-xl border">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b p-[14px_18px]">
          <p className="text-[17px] font-extrabold capitalize">{title}</p>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{t("count", { count: events.length })}</span>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-lg border bg-muted p-0.5">
              {(["semana", "mes"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={cn(
                    "flex h-[26px] items-center rounded-[7px] px-2.5 text-xs font-semibold",
                    mode === m ? "bg-background shadow-sm" : "text-muted-foreground",
                  )}
                >
                  {t(`view.${m === "semana" ? "week" : "month"}`)}
                </button>
              ))}
            </div>
            <button type="button" onClick={goPrevious} className="flex size-8 items-center justify-center rounded-lg border hover:bg-accent">
              <ChevronLeft className="size-4" />
            </button>
            <button type="button" onClick={goNext} className="flex size-8 items-center justify-center rounded-lg border hover:bg-accent">
              <ChevronRight className="size-4" />
            </button>
            <button type="button" onClick={goToday} className="flex h-8 items-center rounded-lg border px-3 text-sm font-medium hover:bg-accent">
              {t("view.today")}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-3">
          {loading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">…</p>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-muted-foreground">{t("loadError")}</p>
              <button type="button" onClick={() => void refresh()} className="text-sm font-medium text-primary hover:underline">
                {t("retry")}
              </button>
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
