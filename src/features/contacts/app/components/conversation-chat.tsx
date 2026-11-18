"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChatEventBlock } from "@/features/contacts/app/components/chat-event-block";
import { ChatMessageBubble, DateSeparator, dateSeparatorLabel } from "@/features/contacts/app/components/chat-message-bubble";
import { ChatNoteBlock } from "@/features/contacts/app/components/chat-note-block";
import { EventComposer } from "@/features/contacts/app/components/event-composer";
import { NoteComposer } from "@/features/contacts/app/components/note-composer";
import { PinnedNotesBar } from "@/features/contacts/app/components/pinned-notes-bar";
import { ConversationChatHeader } from "@/features/contacts/app/components/conversation-chat-header";
import { ConversationChatSkeleton } from "@/features/contacts/app/components/conversation-chat-skeleton";
import { ConversationComposerBar } from "@/features/contacts/app/components/conversation-composer-bar";
import { useCreateAgendaEvent } from "@/features/agenda/app/hooks/use-create-agenda-event";
import { resolvePhraseVariables } from "@/features/contacts/app/utils/resolve-phrase-variables";
import { CHAT_BACKGROUND_CLASS } from "@/features/contacts/app/utils/chat-style";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useLocale, useTranslations } from "next-intl";
import type { AgendaEventDto, CreateAgendaEventRequestBody } from "@/types/api/agenda-v1";
import type {
  ConversationDetailResponseData,
  ConversationStatus,
  LeadNoteDto,
  MessageDto,
  QuickPhraseDto,
  UpsertLeadNoteRequestBody,
} from "@/types/api/contacts-v1";

const BUILTIN_COMMANDS: QuickPhraseDto[] = [
  { id: "cmd-agendar", slug: "agendar", title: "Agendar compromisso", body: "Abre o formulário de agendamento.", attachment: null, usageCount: 0, createdAt: "", updatedAt: "" },
  { id: "cmd-notas", slug: "notas", title: "Nota interna", body: "Abre o formulário de nota interna.", attachment: null, usageCount: 0, createdAt: "", updatedAt: "" },
];

type TimelineItem =
  | { kind: "message"; timestamp: string; message: MessageDto }
  | { kind: "note"; timestamp: string; note: LeadNoteDto }
  | { kind: "event"; timestamp: string; event: AgendaEventDto };

type ConversationChatProps = {
  conversationId: string;
  data: ConversationDetailResponseData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  sendMessage: (body: string) => Promise<void>;
  notes: LeadNoteDto[];
  createNote: (input: UpsertLeadNoteRequestBody) => Promise<LeadNoteDto>;
  updateNote: (id: string, input: Partial<UpsertLeadNoteRequestBody>) => Promise<LeadNoteDto>;
  deleteNote: (id: string) => Promise<void>;
  phrases: QuickPhraseDto[];
  leadPanelOpen: boolean;
  onOpenLeadPanel: (openStagePicker?: boolean) => void;
  onCloseLeadPanel: () => void;
  /** Etapa vinda do estado do pai (fonte da verdade) — sobrepõe a etapa do fetch interno, que não é atualizado quando o LeadPanel muda a etapa. */
  stageOverride?: ConversationStatus;
};

export function ConversationChat({
  conversationId,
  data,
  loading,
  error,
  refresh,
  sendMessage,
  notes,
  createNote,
  updateNote,
  deleteNote,
  phrases,
  leadPanelOpen,
  onOpenLeadPanel,
  onCloseLeadPanel,
  stageOverride,
}: ConversationChatProps) {
  const t = useTranslations("contacts");
  const tDetail = useTranslations("contacts.detail");
  const locale = useLocale();
  const router = useRouter();
  const { mutateAsync: createEvent } = useCreateAgendaEvent();

  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<string | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const [noteOpen, setNoteOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<LeadNoteDto | null>(null);
  const [eventOpen, setEventOpen] = useState(false);
  const [sessionEvents, setSessionEvents] = useState<AgendaEventDto[]>([]);
  const [slashDismissed, setSlashDismissed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  const slashMatch = /^\/([^\s]*)$/.exec(draft);
  const slashQuery = slashMatch?.[1]?.toLowerCase() ?? "";
  const filteredPhrases = useMemo(() => {
    if (!slashMatch) return [];
    const all = [...BUILTIN_COMMANDS, ...phrases];
    return all.filter(
      (p) => p.slug.toLowerCase().startsWith(slashQuery) || p.title.toLowerCase().includes(slashQuery),
    );
  }, [slashMatch, slashQuery, phrases]);
  const popoverOpen = Boolean(slashMatch) && !noteOpen && !eventOpen && !slashDismissed;

  // Fecha o popover de frases ao clicar fora do composer (mantém o texto digitado).
  useEffect(() => {
    if (!popoverOpen) return;
    function handlePointerDown(e: MouseEvent) {
      if (composerRef.current && !composerRef.current.contains(e.target as Node)) {
        setSlashDismissed(true);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [popoverOpen]);

  const pinnedNotes = notes.filter((n) => n.pinned);

  const timeline: TimelineItem[] = useMemo(() => {
    const items: TimelineItem[] = [];
    for (const m of data?.messages ?? []) items.push({ kind: "message", timestamp: m.createdAt, message: m });
    for (const n of notes) items.push({ kind: "note", timestamp: n.createdAt, note: n });
    for (const e of sessionEvents) items.push({ kind: "event", timestamp: e.createdAt, event: e });
    return items.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }, [data?.messages, notes, sessionEvents]);

  function applyPhraseSelection(phrase: QuickPhraseDto) {
    if (phrase.id === "cmd-notas") {
      setEditingNote(null);
      setNoteOpen(true);
      setDraft("");
      return;
    }
    if (phrase.id === "cmd-agendar") {
      setEventOpen(true);
      setDraft("");
      return;
    }
    const resolved = resolvePhraseVariables(phrase.body, {
      nome: data?.conversation.clientName ?? data?.conversation.displayName ?? "",
      medico: "",
      data: "",
    });
    setDraft(resolved);
    setSlashIndex(0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (popoverOpen && e.key === "Escape") {
      e.preventDefault();
      setSlashDismissed(true);
      return;
    }
    if (popoverOpen && filteredPhrases.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIndex((i) => (i + 1) % filteredPhrases.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex((i) => (i - 1 + filteredPhrases.length) % filteredPhrases.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        applyPhraseSelection(filteredPhrases[slashIndex]);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !popoverOpen) {
      e.preventDefault();
      void handleSend();
    }
  }

  async function handleSend() {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    setAttachment(null);
    try {
      await sendMessage(body);
    } catch {
      toast.error(t("chat.sendError"));
    }
  }

  async function handleSaveNote(input: { text: string; color: LeadNoteDto["color"]; pinned: boolean }) {
    try {
      if (editingNote) {
        await updateNote(editingNote.id, input);
      } else {
        await createNote(input);
      }
      setNoteOpen(false);
      setEditingNote(null);
    } catch {
      toast.error(t("chat.sendError"));
    }
  }

  async function handleSaveEvent(input: CreateAgendaEventRequestBody) {
    try {
      const created = await createEvent(input);
      setSessionEvents((prev) => [...prev, created]);
      setEventOpen(false);
      void refresh();
    } catch {
      toast.error(t("chat.sendError"));
    }
  }

  if (loading) {
    return <ConversationChatSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">{t("detail.loadError")}</p>
        <button type="button" onClick={() => void refresh()} className="text-sm font-medium text-primary hover:underline">
          {t("detail.retry")}
        </button>
      </div>
    );
  }

  const { conversation } = data;
  const displayStatus = stageOverride ?? conversation.status;
  let lastDateKey: string | null = null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ConversationChatHeader
        conversation={conversation}
        displayStatus={displayStatus}
        leadPanelOpen={leadPanelOpen}
        onOpenLeadPanel={onOpenLeadPanel}
        onCloseLeadPanel={onCloseLeadPanel}
      />

      <PinnedNotesBar notes={pinnedNotes} />

      <div className={cn("flex-1 space-y-1.5 overflow-y-auto p-4", CHAT_BACKGROUND_CLASS)}>
        {timeline.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">{t("detail.empty")}</p>
        ) : (
          timeline.map((item) => {
            const dateKey = item.timestamp.slice(0, 10);
            const showSeparator = dateKey !== lastDateKey;
            lastDateKey = dateKey;
            const key = item.kind === "message" ? item.message.id : item.kind === "note" ? `note-${item.note.id}` : `event-${item.event.id}`;
            return (
              <div key={key}>
                {showSeparator && <DateSeparator label={dateSeparatorLabel(item.timestamp, locale, tDetail)} />}
                {item.kind === "message" && <ChatMessageBubble message={item.message} locale={locale} />}
                {item.kind === "note" && (
                  <ChatNoteBlock
                    note={item.note}
                    onPin={() => void updateNote(item.note.id, { pinned: !item.note.pinned })}
                    onEdit={() => {
                      setEditingNote(item.note);
                      setNoteOpen(true);
                    }}
                    onDelete={() => void deleteNote(item.note.id)}
                  />
                )}
                {item.kind === "event" && (
                  <ChatEventBlock event={item.event} onOpenInAgenda={() => router.push("/dashboard/agenda")} />
                )}
              </div>
            );
          })
        )}
      </div>

      {noteOpen && (
        <div className="border-t bg-background p-3">
          <NoteComposer
            editingNote={editingNote}
            authorLabel={conversation.assignedToUserName ?? "—"}
            onSave={handleSaveNote}
            onCancel={() => {
              setNoteOpen(false);
              setEditingNote(null);
            }}
          />
        </div>
      )}

      {eventOpen && (
        <div className="border-t bg-background p-3">
          <EventComposer
            leadName={conversation.clientName ?? conversation.displayName}
            conversationId={conversationId}
            clientId={conversation.clientId}
            onSave={handleSaveEvent}
            onCancel={() => setEventOpen(false)}
          />
        </div>
      )}

      <ConversationComposerBar
        composerRef={composerRef}
        fileInputRef={fileInputRef}
        draft={draft}
        attachment={attachment}
        popoverOpen={popoverOpen}
        filteredPhrases={filteredPhrases}
        slashIndex={slashIndex}
        onSlashIndexChange={setSlashIndex}
        onDraftChange={setDraft}
        onSlashDismissedChange={setSlashDismissed}
        onAttachmentChange={setAttachment}
        onSelectPhrase={applyPhraseSelection}
        onKeyDown={handleKeyDown}
        onSend={() => void handleSend()}
      />
    </div>
  );
}
