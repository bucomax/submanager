"use client";

import { useState } from "react";
import { EVENT_TYPE_COLOR, NOTE_COLOR_TOKENS } from "@/features/contacts/app/utils/note-colors";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";
import type { AgendaEventDto } from "@/types/api/agenda-v1";

const MAX_CHIPS = 3;

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildMonthCells(monthStart: Date): Date[] {
  const firstWeekday = monthStart.getDay(); // 0=dom
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - firstWeekday);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

type AgendaMonthGridProps = {
  monthStart: Date;
  events: AgendaEventDto[];
  onEventClick: (event: AgendaEventDto) => void;
};

export function AgendaMonthGrid({ monthStart, events, onEventClick }: AgendaMonthGridProps) {
  const locale = useLocale();
  const t = useTranslations("agenda");
  const tType = useTranslations("contacts.event.type");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const today = new Date();
  const cells = buildMonthCells(monthStart);

  const weekdayFormatter = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pt-BR", { weekday: "short" });
  const weekdayLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, i); // 2024-01-00 é um domingo
    return weekdayFormatter.format(d);
  });

  return (
    <div className="min-w-[770px]">
      <div className="grid grid-cols-7 border-b">
        {weekdayLabels.map((label) => (
          <div key={label} className="p-2 text-center text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6">
        {cells.map((day) => {
          const inMonth = day.getMonth() === monthStart.getMonth();
          const isToday = isSameDay(day, today);
          const dayEvents = events.filter((e) => isSameDay(new Date(e.startsAt), day));
          const visible = dayEvents.slice(0, MAX_CHIPS);
          const extra = dayEvents.length - visible.length;

          return (
            <div
              key={day.toISOString()}
              className={cn("min-h-[104px] border-r border-b p-1.5", !inMonth && "bg-muted opacity-55")}
            >
              <span
                className={cn(
                  "flex size-[22px] items-center justify-center rounded-full text-xs font-semibold",
                  isToday && "bg-primary text-primary-foreground",
                )}
              >
                {day.getDate()}
              </span>
              <div className="mt-1 space-y-0.5">
                {visible.map((event) => {
                  const token = NOTE_COLOR_TOKENS[EVENT_TYPE_COLOR[event.type]];
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onEventClick(event)}
                      onMouseEnter={() => setHoveredId(event.id)}
                      onMouseLeave={() => setHoveredId((id) => (id === event.id ? null : id))}
                      className="relative flex w-full items-center gap-1 truncate rounded-md px-1 py-0.5 text-left text-[11px]"
                      style={{ background: token.soft }}
                    >
                      <span className="size-1.5 shrink-0 rounded-full" style={{ background: token.solid }} />
                      <span className="tabular-nums">
                        {new Date(event.startsAt).toLocaleTimeString(locale === "en" ? "en-US" : "pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="truncate">{event.title}</span>

                      {hoveredId === event.id && (
                        <div className="pointer-events-none absolute top-full left-0 z-20 mt-1.5 min-w-[190px] rounded-lg bg-foreground p-2 text-background shadow-lg">
                          <p className="text-[12px] font-extrabold">{event.title}</p>
                          <p className="text-[11px]">
                            {tType(event.type)} · {new Date(event.startsAt).toLocaleDateString(locale === "en" ? "en-US" : "pt-BR")}
                          </p>
                          {event.leadName && <p className="text-[11px]">{event.leadName}</p>}
                        </div>
                      )}
                    </button>
                  );
                })}
                {extra > 0 && (
                  <p className="px-1 text-[11px] text-muted-foreground">{t("moreCount", { count: extra })}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
