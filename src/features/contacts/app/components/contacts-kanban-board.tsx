"use client";

import { ConversationCard } from "@/features/contacts/app/components/conversation-card";
import { useConversationsBoard } from "@/features/contacts/app/hooks/use-conversations-board";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useTranslations } from "next-intl";
import type { ConversationStatus } from "@/types/api/contacts-v1";

const COLUMN_ORDER: ConversationStatus[] = [
  "new",
  "in_progress",
  "waiting_contact",
  "qualified",
  "discarded",
];

export function ContactsKanbanBoard() {
  const t = useTranslations("contacts.board");
  const { data, loading, error, refresh } = useConversationsBoard();

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

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {COLUMN_ORDER.map((status) => {
        const cards = data?.columns[status] ?? [];
        return (
          <div
            key={status}
            className="flex h-[calc(100vh-14rem)] w-72 shrink-0 flex-col rounded-xl border bg-muted/20"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-t-xl border-b bg-muted/40 px-3 py-2 backdrop-blur">
              <h2 className="text-sm font-semibold">{t(`column.${status}`)}</h2>
              <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {cards.length}
              </span>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-2">
              {cards.length === 0 ? (
                <p className="px-2 py-8 text-center text-xs text-muted-foreground">
                  {t("column.empty")}
                </p>
              ) : (
                cards.map((conversation) => (
                  <ConversationCard key={conversation.id} conversation={conversation} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
