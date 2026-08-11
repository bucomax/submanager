"use client";

import { EVENT_TYPE_COLOR, NOTE_COLOR_TOKENS } from "@/features/contacts/app/utils/note-colors";
import { CalendarCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AgendaEventDto } from "@/types/api/agenda-v1";

type ChatEventBlockProps = {
  event: AgendaEventDto;
  onOpenInAgenda: () => void;
};

function formatEventRange(startsAt: string, durationMin: number): string {
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + durationMin * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${pad(start.getDate())}/${pad(start.getMonth() + 1)}`;
  const startTime = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
  const endTime = `${pad(end.getHours())}:${pad(end.getMinutes())}`;
  return `${date} · ${startTime}–${endTime}`;
}

export function ChatEventBlock({ event, onOpenInAgenda }: ChatEventBlockProps) {
  const tChat = useTranslations("contacts.chat");
  const tStage = useTranslations("contacts.event.type");
  const token = NOTE_COLOR_TOKENS[EVENT_TYPE_COLOR[event.type]];

  return (
    <div
      className="mx-auto my-1.5 w-[min(92%,560px)] rounded-[10px] border p-[9px_12px] text-[13px] dark:bg-white/[0.06] dark:text-[#e9edef]"
      style={{
        borderColor: token.line,
        borderLeftColor: token.solid,
        borderLeftWidth: 3,
        background: token.soft,
      }}
    >
      <div className="mb-1 flex items-center gap-2">
        <CalendarCheck className="size-3" style={{ color: token.ink }} aria-hidden />
        <span className="text-[11px] font-extrabold tracking-wide uppercase" style={{ color: token.ink }}>
          {tStage(event.type)}
        </span>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {formatEventRange(event.startsAt, event.durationMin)}
        </span>
        <button
          type="button"
          onClick={onOpenInAgenda}
          className="ml-auto flex h-6 items-center rounded-md bg-black/[0.06] px-2 text-[11px] font-semibold hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
        >
          {tChat("openInAgenda")}
        </button>
      </div>
      <p className="font-bold">{event.title}</p>
      {event.ownerUserName && <p className="text-[11px] text-muted-foreground">{event.ownerUserName}</p>}
    </div>
  );
}
