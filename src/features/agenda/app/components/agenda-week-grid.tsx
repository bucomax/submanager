"use client";

import { useState } from "react";
import { EVENT_TYPE_COLOR, NOTE_COLOR_TOKENS } from "@/features/contacts/app/utils/note-colors";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";
import type { AgendaEventDto } from "@/types/api/agenda-v1";

const START_HOUR = 8;
const END_HOUR = 20;
const SLOT_HEIGHT = 56;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function eventPosition(event: AgendaEventDto) {
  const start = new Date(event.startsAt);
  const startMin = start.getHours() * 60 + start.getMinutes();
  const top = ((startMin - START_HOUR * 60) / 60) * SLOT_HEIGHT;
  const height = Math.max(38, (event.durationMin / 60) * SLOT_HEIGHT - 4);
  return { top, height };
}

type AgendaWeekGridProps = {
  weekStart: Date;
  events: AgendaEventDto[];
  onEventClick: (event: AgendaEventDto) => void;
};

export function AgendaWeekGrid({ weekStart, events, onEventClick }: AgendaWeekGridProps) {
  const locale = useLocale();
  const tType = useTranslations("contacts.event.type");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const today = new Date();

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const dayFormatter = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pt-BR", { weekday: "short" });

  return (
    <div className="min-w-[820px] overflow-x-auto">
      <div className="grid" style={{ gridTemplateColumns: `64px repeat(7, minmax(120px,1fr))` }}>
        <div className="sticky top-0 z-10 h-14 bg-background" />
        {days.map((day) => {
          const isToday = isSameDay(day, today);
          return (
            <div key={day.toISOString()} className="sticky top-0 z-10 flex h-14 flex-col items-center justify-center gap-0.5 bg-background border-b">
              <span className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                {dayFormatter.format(day)}
              </span>
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-[15px] font-bold",
                  isToday && "bg-primary text-primary-foreground",
                )}
              >
                {day.getDate()}
              </span>
            </div>
          );
        })}

        <div className="col-start-1">
          {HOURS.map((hour) => (
            <div key={hour} className="border-b text-right pr-1.5 text-[11px] text-muted-foreground" style={{ height: SLOT_HEIGHT }}>
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {days.map((day, dayIndex) => {
          const isToday = isSameDay(day, today);
          const dayEvents = events.filter((e) => isSameDay(new Date(e.startsAt), day));
          return (
            <div
              key={day.toISOString()}
              className={cn("relative border-l", isToday && "bg-muted/40")}
              style={{ gridColumnStart: dayIndex + 2 }}
            >
              {HOURS.map((hour) => (
                <div key={hour} className="border-b" style={{ height: SLOT_HEIGHT }} />
              ))}
              {dayEvents.map((event) => {
                const { top, height } = eventPosition(event);
                const token = NOTE_COLOR_TOKENS[EVENT_TYPE_COLOR[event.type]];
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onEventClick(event)}
                    onMouseEnter={() => setHoveredId(event.id)}
                    onMouseLeave={() => setHoveredId((id) => (id === event.id ? null : id))}
                    className="absolute right-1 left-1 overflow-hidden rounded-lg border p-1 text-left"
                    style={{ top, height, borderLeft: `3px solid ${token.solid}`, background: token.soft }}
                  >
                    <p className="text-[11px] font-extrabold tabular-nums">
                      {new Date(event.startsAt).toLocaleTimeString(locale === "en" ? "en-US" : "pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <p className="truncate text-[12px] font-bold">{event.title}</p>
                    {event.leadName && <p className="truncate text-[11px]">{event.leadName}</p>}

                    {hoveredId === event.id && (
                      <div className="pointer-events-none absolute top-full left-0 z-20 mt-1.5 min-w-[190px] rounded-lg bg-foreground p-2 text-background shadow-lg">
                        <p className="text-[12px] font-extrabold">{event.title}</p>
                        <p className="text-[11px]">
                          {tType(event.type)} · {new Date(event.startsAt).toLocaleDateString(locale === "en" ? "en-US" : "pt-BR")}
                        </p>
                        {event.leadName && <p className="text-[11px]">{event.leadName}</p>}
                        {event.ownerUserName && <p className="text-[11px]">{event.ownerUserName}</p>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
