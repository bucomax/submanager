"use client";

import { useState } from "react";
import { NOTE_COLOR_TOKENS } from "@/features/contacts/app/utils/note-colors";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/lib/utils";
import { NotebookPen, Pin } from "lucide-react";
import { useTranslations } from "next-intl";
import type { LeadNoteColor, LeadNoteDto, UpsertLeadNoteRequestBody } from "@/types/api/contacts-v1";

const COLORS: LeadNoteColor[] = ["amber", "sky", "emerald", "violet"];

type NoteComposerProps = {
  editingNote?: LeadNoteDto | null;
  authorLabel: string;
  onSave: (input: UpsertLeadNoteRequestBody) => Promise<void>;
  onCancel: () => void;
};

export function NoteComposer({ editingNote, authorLabel, onSave, onCancel }: NoteComposerProps) {
  const t = useTranslations("contacts.notes");
  const [text, setText] = useState(editingNote?.text ?? "");
  const [color, setColor] = useState<LeadNoteColor>(editingNote?.color ?? "amber");
  const [pinned, setPinned] = useState(editingNote?.pinned ?? true);
  const [saving, setSaving] = useState(false);

  const isEditing = Boolean(editingNote);

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await onSave({ text: text.trim(), color, pinned });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="animate-pop-in rounded-xl border border-l-[3px] border-l-[#f59e0b] bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <NotebookPen className="size-3.5 text-[#b45309]" aria-hidden />
        <span className="text-[11px] font-extrabold tracking-wide uppercase">
          {isEditing ? t("editTitle") : t("formTitle")}
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {authorLabel} · {t("notSent")}
        </span>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("placeholder")}
        rows={3}
        autoFocus
        className="w-full resize-none rounded-md border bg-transparent p-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />

      <div className="mt-2.5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          {COLORS.map((c) => {
            const token = NOTE_COLOR_TOKENS[c];
            return (
              <button
                key={c}
                type="button"
                aria-label={t(`colors.${c}`)}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={cn(
                  "size-5 rounded-full",
                  color === c ? "border-2 border-foreground" : "border border-transparent",
                )}
                style={{ background: token.solid }}
              />
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setPinned((p) => !p)}
          aria-pressed={pinned}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium",
            pinned
              ? "border-[rgba(245,158,11,.5)] bg-[rgba(245,158,11,.14)] text-[#92400e]"
              : "text-muted-foreground",
          )}
        >
          <Pin className="size-3" fill={pinned ? "currentColor" : "none"} />
          {t("pin")}
        </button>

        <div className="ml-auto flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button type="button" size="sm" disabled={!text.trim() || saving} onClick={() => void handleSave()}>
            {isEditing ? t("save") : t("create")}
          </Button>
        </div>
      </div>
    </div>
  );
}
