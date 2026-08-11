"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChatEventBlock } from "@/features/contacts/app/components/chat-event-block";
import { ChatMessageBubble, DateSeparator, dateSeparatorLabel } from "@/features/contacts/app/components/chat-message-bubble";
import { ChatNoteBlock } from "@/features/contacts/app/components/chat-note-block";
import { EventComposer } from "@/features/contacts/app/components/event-composer";
import { NoteComposer } from "@/features/contacts/app/components/note-composer";
import { PinnedNotesBar } from "@/features/contacts/app/components/pinned-notes-bar";
import { QuickPhrasePopover } from "@/features/contacts/app/components/quick-phrase-popover";
import { createAgendaEvent } from "@/features/agenda/app/services/agenda.service";
import { resolvePhraseVariables } from "@/features/contacts/app/utils/resolve-phrase-variables";
import { STAGE_PILL_CLASS } from "@/features/contacts/app/utils/stage-colors";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { ChevronsUpDown, Paperclip, Send, UserPen, UserRound, Zap } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { AgendaEventDto } from "@/types/api/agenda-v1";
import type {
  ConversationDetailResponseData,
  ConversationStatus,
  LeadNoteDto,
  MessageDto,
  QuickPhraseDto,
  UpsertLeadNoteRequestBody,
} from "@/types/api/contacts-v1";

/** Fundo pontilhado estilo WhatsApp — reaproveitado pelo skeleton de loading e pela timeline real. */
const CHAT_BACKGROUND_CLASS =
  "bg-[#f0f2f5] bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.035)_1px,transparent_0)] bg-[length:18px_18px] dark:bg-[#0b141a] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.035)_1px,transparent_0)]";

const BUILTIN_COMMANDS: QuickPhraseDto[] = [
  { id: "cmd-agendar", slug: "agendar", title: "Agendar compromisso", body: "Abre o formulário de agendamento.", attachment: null, usageCount: 0, createdAt: "", updatedAt: "" },
  { id: "cmd-notas", slug: "notas", title: "Nota interna", body: "Abre o formulário de nota interna.", attachment: null, usageCount: 0, createdAt: "", updatedAt: "" },
];

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

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

  async function handleSaveEvent(input: Parameters<typeof createAgendaEvent>[0]) {
    try {
      const created = await createAgendaEvent(input);
      setSessionEvents((prev) => [...prev, created]);
      setEventOpen(false);
      void refresh();
    } catch {
      toast.error(t("chat.sendError"));
    }
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex min-h-[60px] items-center gap-2 border-b px-3.5">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-44" />
          </div>
          <Skeleton className="h-[26px] w-24 shrink-0 rounded-full" />
          <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
        </div>

        <div className={cn("flex-1 space-y-3 overflow-hidden p-4", CHAT_BACKGROUND_CLASS)}>
          <div className="flex justify-center">
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="flex justify-start">
            <Skeleton className="h-12 w-2/3 rounded-2xl rounded-bl-md" />
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-10 w-1/2 rounded-2xl rounded-br-md" />
          </div>
          <div className="flex justify-start">
            <Skeleton className="h-16 w-3/5 rounded-2xl rounded-bl-md" />
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-8 w-2/5 rounded-2xl rounded-br-md" />
          </div>
        </div>

        <div className="border-t bg-background p-[10px_14px_14px]">
          <div className="flex items-center gap-2">
            <Skeleton className="size-[38px] shrink-0 rounded-full" />
            <Skeleton className="size-[38px] shrink-0 rounded-full" />
            <Skeleton className="h-[38px] flex-1 rounded-[10px]" />
            <Skeleton className="size-[38px] shrink-0 rounded-full" />
          </div>
        </div>
      </div>
    );
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
      <div className="flex min-h-[60px] items-center gap-2 border-b px-3.5">
        <Avatar size="sm">
          <AvatarFallback>
            {conversation.clientId ? initialsFromName(conversation.displayName) : <UserRound className="size-4" />}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{conversation.displayName}</p>
          <p className="truncate text-xs tabular-nums text-muted-foreground">
            {conversation.externalId} · #{conversation.id.slice(-8)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
          <button
            type="button"
            onClick={() => onOpenLeadPanel(true)}
            title={t("chat.changeStage")}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold",
              STAGE_PILL_CLASS[displayStatus],
            )}
          >
            {t(`stage.${displayStatus}`)}
            <ChevronsUpDown className="size-3" />
          </button>
          <button
            type="button"
            onClick={() => (leadPanelOpen ? onCloseLeadPanel() : onOpenLeadPanel())}
            className="flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium hover:bg-accent"
          >
            <UserPen className="size-3.5" />
            {leadPanelOpen ? t("chat.closeLead") : t("chat.editLead")}
          </button>
        </div>
      </div>

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

      <div ref={composerRef} className="relative border-t bg-background p-[10px_14px_14px]">
        {popoverOpen && (
          <QuickPhrasePopover
            phrases={filteredPhrases}
            activeIndex={Math.min(slashIndex, Math.max(filteredPhrases.length - 1, 0))}
            onHoverIndex={setSlashIndex}
            onSelect={applyPhraseSelection}
            onCreateFromDraft={() => setDraft("")}
          />
        )}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => {
                    setDraft("/");
                    setSlashDismissed(false);
                  }}
                  className="flex size-[38px] shrink-0 items-center justify-center rounded-full border hover:bg-accent"
                >
                  <Zap className="size-4" />
                </button>
              }
            />
            <TooltipContent>{t("chat.phrases")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex size-[38px] shrink-0 items-center justify-center rounded-full border hover:bg-accent"
                >
                  <Paperclip className="size-4" />
                </button>
              }
            />
            <TooltipContent>{t("chat.attach")}</TooltipContent>
          </Tooltip>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => setAttachment(e.target.files?.[0]?.name ?? null)}
          />
          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setSlashDismissed(false);
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={t("chat.composerPlaceholder")}
            className="max-h-[120px] min-h-[38px] flex-1 resize-none rounded-[10px] border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={!draft.trim()}
                  className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
                >
                  <Send className="size-4" />
                </button>
              }
            />
            <TooltipContent>{t("chat.send")}</TooltipContent>
          </Tooltip>
        </div>
        {attachment && <p className="mt-1.5 text-xs text-muted-foreground">{attachment}</p>}
      </div>
    </div>
  );
}
