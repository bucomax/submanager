"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, NotebookPen, Pencil, Pin, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { LeadStagePicker } from "@/features/contacts/app/components/lead-stage-picker";
import { getClientDetail, updateClient } from "@/features/clients/app/services/clients.service";
import { NOTE_COLOR_TOKENS } from "@/features/contacts/app/utils/note-colors";
import { STAGE_ORDER } from "@/features/contacts/app/utils/stage-colors";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { calendarDaysFromNow } from "@/lib/utils/date";
import { toast } from "@/lib/toast";
import type { ClientDetailClientDto } from "@/types/api/clients-v1";
import type {
  ConversationCardDto,
  ConversationStatus,
  LeadNoteDto,
  UpsertLeadNoteRequestBody,
} from "@/types/api/contacts-v1";

type ClientFormState = {
  name: string;
  phone: string;
  email: string;
  documentId: string;
  caseDescription: string;
};

function toFormState(client: ClientDetailClientDto): ClientFormState {
  return {
    name: client.name,
    phone: client.phone,
    email: client.email ?? "",
    documentId: client.documentId ?? "",
    caseDescription: client.caseDescription ?? "",
  };
}

type LeadPanelProps = {
  open: boolean;
  onClose: () => void;
  conversation: ConversationCardDto;
  stageChangedAt: string;
  stagePickerOpen: boolean;
  onStagePickerOpenChange: (open: boolean) => void;
  onStageChange: (status: ConversationStatus) => Promise<void>;
  notes: LeadNoteDto[];
  createNote: (input: UpsertLeadNoteRequestBody) => Promise<LeadNoteDto>;
  updateNote: (id: string, input: Partial<UpsertLeadNoteRequestBody>) => Promise<LeadNoteDto>;
  deleteNote: (id: string) => Promise<void>;
};

export function LeadPanel({
  open,
  onClose,
  conversation,
  stageChangedAt,
  stagePickerOpen,
  onStagePickerOpenChange,
  onStageChange,
  notes,
  createNote,
  updateNote,
  deleteNote,
}: LeadPanelProps) {
  const t = useTranslations("contacts");
  const [form, setForm] = useState<ClientFormState | null>(null);
  const [loadingClient, setLoadingClient] = useState(false);
  const [saving, setSaving] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteFormOpen, setNoteFormOpen] = useState(false);
  const [saveHint, setSaveHint] = useState("");

  useEffect(() => {
    if (!open) return;
    if (conversation.clientId) {
      setLoadingClient(true);
      void getClientDetail(conversation.clientId)
        .then((detail) => setForm(toFormState(detail.client)))
        .catch(() => setForm(null))
        .finally(() => setLoadingClient(false));
    } else {
      setForm(null);
    }
  }, [open, conversation.clientId]);

  if (!open) return null;

  const daysInStage = calendarDaysFromNow(stageChangedAt);
  const stageIndex = STAGE_ORDER.indexOf(conversation.status);

  async function handleSaveClient() {
    if (!conversation.clientId || !form) return;
    setSaving(true);
    try {
      await updateClient(conversation.clientId, {
        name: form.name,
        phone: form.phone,
        email: form.email || undefined,
        documentId: form.documentId || null,
        caseDescription: form.caseDescription || null,
      });
      setSaveHint(t("chat.leadSaved"));
      toast.success(t("chat.leadSaved"));
    } catch {
      // apiClient já mostra toast.error
    } finally {
      setSaving(false);
    }
  }

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
    <div className="flex h-full flex-col overflow-hidden border-l bg-card">
      <div className="space-y-3 p-3.5" style={{ background: "#243b47", color: "#e9edef" }}>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t("chat.closeLead")}
                  className="flex size-[26px] items-center justify-center rounded-md hover:bg-white/10"
                >
                  <ChevronLeft className="size-4" />
                </button>
              }
            />
            <TooltipContent>{t("chat.closeLead")}</TooltipContent>
          </Tooltip>
          <p className="text-lg font-extrabold">Lead #{conversation.id.slice(-8)}</p>
        </div>

        <LeadStagePicker
          open={stagePickerOpen}
          onOpenChange={onStagePickerOpenChange}
          currentStage={conversation.status}
          daysInStage={daysInStage}
          onSelect={(stage) => void onStageChange(stage)}
        />

        <div className="flex gap-1">
          {STAGE_ORDER.map((stage, i) => (
            <span
              key={stage}
              className="h-1 flex-1 rounded-full"
              style={{ background: i <= stageIndex ? "#facc15" : "rgba(255,255,255,.18)" }}
            />
          ))}
        </div>
      </div>

      <div className="grid flex-1 auto-rows-min grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-2.5 overflow-y-auto p-3.5">
        {!conversation.clientId ? (
          <p className="col-span-full text-sm text-muted-foreground">{t("chat.leadNotRegistered")}</p>
        ) : loadingClient || !form ? (
          <p className="col-span-full text-sm text-muted-foreground">…</p>
        ) : (
          <>
            <Field label="Nome">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Telefone">
              <Input className="tabular-nums" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="E-mail">
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="CPF">
              <Input className="tabular-nums" value={form.documentId} onChange={(e) => setForm({ ...form, documentId: e.target.value })} />
            </Field>
            <div className="col-span-full">
              <Field label="Observações">
                <textarea
                  value={form.caseDescription}
                  onChange={(e) => setForm({ ...form, caseDescription: e.target.value })}
                  rows={3}
                  className="w-full resize-none rounded-lg border bg-transparent p-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </Field>
            </div>
          </>
        )}

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
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t p-3">
        <p className="flex-1 truncate text-xs text-muted-foreground">{saveHint}</p>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("chat.closeLead")}
        </Button>
        {conversation.clientId && (
          <Button type="button" disabled={saving} onClick={() => void handleSaveClient()}>
            {t("chat.saveLead")}
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
