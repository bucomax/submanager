"use client";

import { ConversationCard } from "@/features/contacts/app/components/conversation-card";
import { useConversationsBoard } from "@/features/contacts/app/hooks/use-conversations-board";
import { Input } from "@/shared/components/ui/input";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { DEBOUNCE_MS, useDebouncedState } from "@/shared/hooks/use-debounce";
import { cn } from "@/lib/utils";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { AtSign, MessageCircle, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ConversationCardDto, ConversationChannel, ConversationStatus } from "@/types/api/contacts-v1";

/** Colunas exibidas no kanban — `waiting_contact` existe no schema mas não é usado nesta etapa. */
type BoardStatus = Exclude<ConversationStatus, "waiting_contact">;

const COLUMN_ORDER: BoardStatus[] = ["new", "in_progress", "qualified", "discarded"];

const CHANNEL_FILTERS: ConversationChannel[] = ["whatsapp", "instagram"];

const CHANNEL_ICON = {
  whatsapp: MessageCircle,
  instagram: AtSign,
} as const;

function KanbanColumn({
  status,
  cards,
  label,
}: {
  status: BoardStatus;
  cards: ConversationCardDto[];
  label: string;
}) {
  const t = useTranslations("contacts.board");
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-[calc(100vh-16rem)] w-72 shrink-0 flex-col rounded-xl border bg-muted/20 transition-colors",
        isOver && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-t-xl border-b bg-muted/40 px-3 py-2 backdrop-blur">
        <h2 className="text-sm font-semibold">{label}</h2>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {cards.length}
        </span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {cards.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">{t("column.empty")}</p>
        ) : (
          cards.map((conversation) => (
            <ConversationCard key={conversation.id} conversation={conversation} />
          ))
        )}
      </div>
    </div>
  );
}

export function ContactsKanbanBoard() {
  const t = useTranslations("contacts.board");
  const tCard = useTranslations("contacts.card");
  const { data, loading, error, refresh, moveConversation } = useConversationsBoard();
  const [searchInput, debouncedSearch, setSearchInput] = useDebouncedState("", {
    delayMs: DEBOUNCE_MS.search,
    trim: true,
  });
  const [channelFilter, setChannelFilter] = useState<ConversationChannel | undefined>();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const toStatus = COLUMN_ORDER.find((status) => status === over.id);
    if (!toStatus) return;
    void moveConversation(String(active.id), toStatus);
  }

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-2">
        {COLUMN_ORDER.map((status) => (
          <Skeleton key={status} className="h-96 w-72 shrink-0 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
        <p className="text-sm text-muted-foreground">{t("loadError")}</p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="text-sm font-medium text-primary hover:underline"
        >
          {t("retry")}
        </button>
      </div>
    );
  }

  const totalCards = COLUMN_ORDER.reduce(
    (sum, status) => sum + (data?.columns[status]?.length ?? 0),
    0,
  );

  if (totalCards === 0) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed p-10 text-center">
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </div>
    );
  }

  const query = debouncedSearch.toLowerCase();
  const matchesFilters = (conversation: {
    channel: ConversationChannel;
    displayName: string;
    lastMessagePreview: string | null;
  }) => {
    if (channelFilter && conversation.channel !== channelFilter) return false;
    if (!query) return true;
    return (
      conversation.displayName.toLowerCase().includes(query) ||
      (conversation.lastMessagePreview?.toLowerCase().includes(query) ?? false)
    );
  };

  const hasAnyMatch = COLUMN_ORDER.some((status) =>
    (data?.columns[status] ?? []).some(matchesFilters),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setChannelFilter(undefined)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              !channelFilter
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {t("filterAll")}
          </button>
          {CHANNEL_FILTERS.map((channel) => {
            const Icon = CHANNEL_ICON[channel];
            return (
              <button
                key={channel}
                type="button"
                onClick={() => setChannelFilter(channel === channelFilter ? undefined : channel)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  channelFilter === channel
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                <Icon className="size-3" />
                {tCard(`channel.${channel}`)}
              </button>
            );
          })}
        </div>
      </div>

      {!hasAnyMatch ? (
        <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">{t("noResults")}</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {COLUMN_ORDER.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                cards={(data?.columns[status] ?? []).filter(matchesFilters)}
                label={t(`column.${status}`)}
              />
            ))}
          </div>
        </DndContext>
      )}
    </div>
  );
}
