"use client";

import { NOTE_COLOR_TOKENS } from "@/features/contacts/app/utils/note-colors";
import { formatDateTimeShort } from "@/lib/utils/date";
import { NotebookPen, Pencil, Pin, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { LeadNoteDto } from "@/types/api/contacts-v1";

type ChatNoteBlockProps = {
  note: LeadNoteDto;
  onPin: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function ChatNoteBlock({ note, onPin, onEdit, onDelete }: ChatNoteBlockProps) {
  const t = useTranslations("contacts.notes");
  const locale = useLocale();
  const token = NOTE_COLOR_TOKENS[note.color];
  const editedSuffix = note.editedAt ? ` ${t("editedSuffix")}` : "";

  return (
    <div
      className="mx-auto my-1.5 w-[min(92%,560px)] rounded-[10px] border p-[9px_12px] text-[13px] leading-[1.45] dark:bg-white/[0.06] dark:text-[#e9edef]"
      style={{
        borderColor: token.line,
        borderLeftColor: token.solid,
        borderLeftWidth: 3,
        background: token.soft,
      }}
    >
      <div className="mb-1 flex items-center gap-2">
        <NotebookPen className="size-3" style={{ color: token.ink }} aria-hidden />
        <span className="text-[11px] font-extrabold tracking-wide uppercase" style={{ color: token.ink }}>
          {t("formTitle")}
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {note.authorName ?? "—"} · {formatDateTimeShort(note.createdAt, locale === "en" ? "en-US" : "pt-BR")}
          {editedSuffix}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPin}
            aria-label={note.pinned ? t("pinned") : t("pin")}
            aria-pressed={note.pinned}
            className="flex size-[22px] items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10"
          >
            <Pin className="size-3" fill={note.pinned ? "currentColor" : "none"} />
          </button>
          <button
            type="button"
            onClick={onEdit}
            aria-label={t("editTitle")}
            className="flex size-[22px] items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10"
          >
            <Pencil className="size-3" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={t("deleted")}
            className="flex size-[22px] items-center justify-center rounded-md text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>
      <p className="whitespace-pre-wrap">{note.text}</p>
    </div>
  );
}
