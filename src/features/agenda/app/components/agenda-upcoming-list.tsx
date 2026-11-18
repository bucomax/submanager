"use client";

import { useState } from "react";
import { EVENT_TYPE_COLOR, NOTE_COLOR_TOKENS } from "@/features/contacts/app/utils/note-colors";
import { useRouter } from "@/i18n/navigation";
import { MessageCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { AgendaEventDto } from "@/types/api/agenda-v1";

type AgendaUpcomingListProps = {
  events: AgendaEventDto[];
};

export function AgendaUpcomingList({ events }: AgendaUpcomingListProps) {
  const t = useTranslations("agenda");
  const tType = useTranslations("contacts.event.type");
  const locale = useLocale();
  const router = useRouter();
  // Capturado uma vez por montagem — evita `Date.now()` impuro direto no corpo do render.
  const [now] = useState(() => Date.now());

  const upcoming = [...events]
    .filter((e) => new Date(e.startsAt).getTime() >= now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return (
    <aside className="bg-surface hidden w-[320px] shrink-0 flex-col border-l p-4 xl:flex">
      <h2 className="text-foreground mb-3 text-[17px] font-bold tracking-tight">{t("upcoming.title")}</h2>
      {upcoming.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("upcoming.empty")}</p>
      ) : (
        <div className="space-y-2 overflow-y-auto">
          {upcoming.map((event) => {
            const token = NOTE_COLOR_TOKENS[EVENT_TYPE_COLOR[event.type]];
            const date = new Date(event.startsAt);
            return (
              <div
                key={event.id}
                className="bg-card rounded-2xl border p-3"
                style={{ borderLeft: `3px solid ${token.solid}` }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold tracking-wide uppercase" style={{ color: token.ink }}>
                    {tType(event.type)}
                  </span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {date.toLocaleDateString(locale === "en" ? "en-US" : "pt-BR", { day: "2-digit", month: "2-digit" })}{" "}
                    {date.toLocaleTimeString(locale === "en" ? "en-US" : "pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="mt-1 text-[13px] font-bold">{event.title}</p>
                <p className="text-xs text-muted-foreground">
                  {event.leadName ?? "—"} · {event.ownerUserName ?? "—"}
                </p>
                {event.conversationId && (
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/contacts/${event.conversationId}`)}
                    className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <MessageCircle className="size-3" />
                    {t("upcoming.openChat")}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
