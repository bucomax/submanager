"use client";

import { useState } from "react";
import { NOTE_COLOR_TOKENS } from "@/features/contacts/app/utils/note-colors";
import { formatDateTimeShort } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { ChevronLeft, ChevronRight, Pin } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { LeadNoteDto } from "@/types/api/contacts-v1";

type PinnedNotesBarProps = {
  notes: LeadNoteDto[];
};

/** Barra de notas fixadas no topo do chat — carrossel quando há mais de uma. */
export function PinnedNotesBar({ notes }: PinnedNotesBarProps) {
  const t = useTranslations("contacts.notes");
  const locale = useLocale();
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);

  if (notes.length === 0) return null;

  const activeIndex = Math.min(index, notes.length - 1);
  const note = notes[activeIndex];
  const token = NOTE_COLOR_TOKENS[note.color];
  const label = notes.length > 1 ? t("pinnedBarMany", { i: activeIndex + 1, n: notes.length }) : t("pinnedBar");

  return (
    <div
      className="flex items-center gap-2.5 border-b py-[9px] pr-3 pl-[14px]"
      style={{ borderLeft: `3px solid ${token.solid}` }}
    >
      <span
        className="flex size-[22px] shrink-0 items-center justify-center rounded-full"
        style={{ background: token.soft, color: token.ink }}
      >
        <Pin className="size-[11px]" fill="currentColor" />
      </span>

      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="min-w-0 flex-1 text-left"
      >
        <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
          {label} · {note.authorName ?? "—"} · {formatDateTimeShort(note.createdAt, locale === "en" ? "en-US" : "pt-BR")}
        </p>
        <p className={cn("text-[13px]", expanded ? "whitespace-pre-wrap" : "truncate")}>{note.text}</p>
      </button>

      {notes.length > 1 && (
        <div className="flex shrink-0 items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={t("pinnedPrev")}
                  onClick={() => setIndex((i) => (i - 1 + notes.length) % notes.length)}
                  className="flex size-6 items-center justify-center rounded-md hover:bg-accent"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
              }
            />
            <TooltipContent>{t("pinnedPrev")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={t("pinnedNext")}
                  onClick={() => setIndex((i) => (i + 1) % notes.length)}
                  className="flex size-6 items-center justify-center rounded-md hover:bg-accent"
                >
                  <ChevronRight className="size-3.5" />
                </button>
              }
            />
            <TooltipContent>{t("pinnedNext")}</TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
}
