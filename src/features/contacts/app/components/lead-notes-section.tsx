"use client";

import { NotebookPen, Pencil, Pin, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { NOTE_COLOR_TOKENS } from "@/features/contacts/app/utils/note-colors";
import { Button } from "@/shared/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import type { LeadNoteDto, UpsertLeadNoteRequestBody } from "@/types/api/contacts-v1";

type LeadNotesSectionProps = {
  notes: LeadNoteDto[];
  createNote: (input: UpsertLeadNoteRequestBody) => Promise<LeadNoteDto>;
  updateNote: (id: string, input: Partial<UpsertLeadNoteRequestBody>) => Promise<LeadNoteDto>;
  deleteNote: (id: string) => Promise<void>;
};

/** Seção de notas do painel do lead: lista + formulário de criar/editar. */
export function LeadNotesSection({ notes, createNote, updateNote, deleteNote }: LeadNotesSectionProps) {
  const t = useTranslations("contacts");
  const [noteDraft, setNoteDraft] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteFormOpen, setNoteFormOpen] = useState(false);

  async function handleSaveNote() {
    if (!noteDraft.trim()) return;
    try {
      if (editingNoteId) {
        await updateNote(editingNoteId, { text: noteDraft.trim() });
      } else {
        await createNote({ text: noteDraft.trim(), color: "amber", pinned: false });
      }
      setNoteDraft("");
      setEditingNoteId(null);
      setNoteFormOpen(false);
    } catch {
      // apiClient já mostra toast.error
    }
  }

  async function handleTogglePin(note: LeadNoteDto) {
    await updateNote(note.id, { pinned: !note.pinned });
  }

  async function handleDeleteNote(id: string) {
    await deleteNote(id);
  }

  return (
    <div className="col-span-full mt-1 border-t pt-3">
      <div className="mb-2 flex items-center gap-2">
        <NotebookPen className="size-3.5" />
        <span className="text-xs font-extrabold tracking-wide uppercase">{t("notes.section")}</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() => {
            setEditingNoteId(null);
            setNoteDraft("");
            setNoteFormOpen(true);
          }}
        >
          <Plus className="size-3.5" />
          {t("notes.new")}
        </Button>
      </div>

      {noteFormOpen && (
        <div className="mb-2 space-y-2 rounded-lg border p-2">
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            rows={2}
            autoFocus
            placeholder={t("notes.placeholder")}
            className="w-full resize-none rounded-md border bg-transparent p-1.5 text-sm outline-none"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setNoteFormOpen(false)}>
              {t("notes.cancel")}
            </Button>
            <Button type="button" size="sm" onClick={() => void handleSaveNote()}>
              {editingNoteId ? t("notes.save") : t("notes.create")}
            </Button>
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("notes.empty")}</p>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => {
            const token = NOTE_COLOR_TOKENS[note.color];
            return (
              <div
                key={note.id}
                className="rounded-[10px] border p-2"
                style={note.pinned ? { background: token.soft, borderColor: token.line } : undefined}
              >
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: token.solid }} />
                  <span className="text-[11px] font-bold">{note.authorName ?? "—"}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(note.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                  <div className="ml-auto flex gap-0.5">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            onClick={() => {
                              setEditingNoteId(note.id);
                              setNoteDraft(note.text);
                              setNoteFormOpen(true);
                            }}
                            aria-label={t("notes.editTitle")}
                            className="flex size-[22px] items-center justify-center rounded hover:bg-accent"
                          >
                            <Pencil className="size-3" />
                          </button>
                        }
                      />
                      <TooltipContent>{t("notes.editTitle")}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            onClick={() => void handleDeleteNote(note.id)}
                            aria-label={t("notes.delete")}
                            className="flex size-[22px] items-center justify-center rounded text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        }
                      />
                      <TooltipContent>{t("notes.delete")}</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <p className="text-[13px] leading-[1.45]">{note.text}</p>
                <button
                  type="button"
                  onClick={() => void handleTogglePin(note)}
                  className="mt-1.5 flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent"
                >
                  <Pin className="size-3" fill={note.pinned ? "currentColor" : "none"} />
                  {note.pinned ? t("notes.pinned") : t("notes.pin")}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
