"use client";

import { useRef, useState } from "react";
import { ConversationListItem } from "@/features/contacts/app/components/conversation-list-item";
import { useConversationsList } from "@/features/contacts/app/hooks/use-conversations-list";
import { STAGE_ORDER } from "@/features/contacts/app/utils/stage-colors";
import { Input } from "@/shared/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { useDebouncedState } from "@/shared/hooks/use-debounce";
import { cn } from "@/lib/utils";
import { AtSign, Check, ChevronDown, CircleDashed, Inbox, Loader2, MessageCircle, Search, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ConversationChannel, ConversationListItemDto, ConversationStatus } from "@/types/api/contacts-v1";

const CHANNEL_SEGMENTS: Array<{
  value: ConversationChannel | undefined;
  icon: typeof Inbox;
  labelKey: "channel.all" | "channel.whatsappOnly" | "channel.instagramOnly";
}> = [
  { value: undefined, icon: Inbox, labelKey: "channel.all" },
  { value: "whatsapp", icon: MessageCircle, labelKey: "channel.whatsappOnly" },
  { value: "instagram", icon: AtSign, labelKey: "channel.instagramOnly" },
];

type ConversationListProps = {
  activeConversationId: string | null;
  onSelectConversation: (item: ConversationListItemDto) => void;
  onOpenPhrasesDrawer: () => void;
};

export function ConversationList({
  activeConversationId,
  onSelectConversation,
  onOpenPhrasesDrawer,
}: ConversationListProps) {
  const t = useTranslations("contacts");
  const [search, debouncedSearch, setSearch] = useDebouncedState("", { trim: true });
  const [channelFilter, setChannelFilter] = useState<ConversationChannel | undefined>(undefined);
  const [stageFilter, setStageFilter] = useState<ConversationStatus | undefined>(undefined);
  const [stagePickerOpen, setStagePickerOpen] = useState(false);

  const { items, totalItems, loading, loadingMore, error, hasMore, loadMore, refresh } = useConversationsList({
    search: debouncedSearch,
    channelFilter,
    stageFilter,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const unreadTotal = items.reduce((sum, i) => sum + i.unreadCount, 0);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el || loadingMore || !hasMore) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 120) {
      void loadMore();
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2.5 border-b p-3">
        <div className="flex items-center gap-2">
          <p className="text-[15px] font-bold">{t("list.title")}</p>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{totalItems}</span>
          {unreadTotal > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#047857]">
              <span className="size-[7px] rounded-full bg-[#10b981]" />
              {t("list.unread", { count: unreadTotal })}
            </span>
          )}
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={onOpenPhrasesDrawer}
                  aria-label={t("list.managePhrases")}
                  className="ml-auto flex size-7 items-center justify-center rounded-lg border hover:bg-accent"
                >
                  <Zap className="size-3.5" />
                </button>
              }
            />
            <TooltipContent>{t("list.managePhrases")}</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("list.searchPlaceholder")}
              className="h-9 rounded-[9px] pl-8"
            />
          </div>
          <div className="flex items-center gap-0.5 rounded-lg border bg-muted p-0.5">
            {CHANNEL_SEGMENTS.map(({ value, icon: Icon, labelKey }) => (
              <Tooltip key={value ?? "all"}>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={() => setChannelFilter(value)}
                      aria-pressed={channelFilter === value}
                      className={cn(
                        "flex h-7 w-[30px] items-center justify-center rounded-[7px]",
                        channelFilter === value
                          ? "bg-background shadow-sm"
                          : "text-muted-foreground opacity-55 hover:opacity-100",
                      )}
                    >
                      <Icon className="size-3.5" />
                    </button>
                  }
                />
                <TooltipContent>{t(labelKey)}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Popover open={stagePickerOpen} onOpenChange={setStagePickerOpen}>
            <PopoverTrigger
              className={cn(
                "flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium",
                stageFilter && "border-foreground",
              )}
            >
              {stageFilter ? t(`stage.${stageFilter}`) : t("list.allStages")}
              <ChevronDown className="size-3" />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[200px] p-1">
              <button
                type="button"
                onClick={() => {
                  setStageFilter(undefined);
                  setStagePickerOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                  !stageFilter ? "bg-accent font-semibold" : "hover:bg-accent",
                )}
              >
                {!stageFilter ? (
                  <Check className="size-3.5 shrink-0" />
                ) : (
                  <CircleDashed className="size-3.5 shrink-0 text-muted-foreground" />
                )}
                {t("list.allStages")}
              </button>
              {STAGE_ORDER.map((stage) => (
                <button
                  key={stage}
                  type="button"
                  onClick={() => {
                    setStageFilter(stage);
                    setStagePickerOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                    stageFilter === stage ? "bg-accent font-semibold" : "hover:bg-accent",
                  )}
                >
                  {stageFilter === stage ? (
                    <Check className="size-3.5 shrink-0" />
                  ) : (
                    <CircleDashed className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                  {t(`stage.${stage}`)}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
            {items.length} / {totalItems}
          </span>
        </div>
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-3 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">{t("list.loadError")}</p>
            <button type="button" onClick={() => void refresh()} className="text-sm font-medium text-primary hover:underline">
              {t("list.retry")}
            </button>
          </div>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">{t("list.noResults")}</p>
        ) : (
          <>
            {items.map((item) => (
              <ConversationListItem
                key={item.id}
                conversation={item}
                active={item.id === activeConversationId}
                onSelect={() => onSelectConversation(item)}
              />
            ))}
            {loadingMore && (
              <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-chat-spin" />
                {t("list.loadingMore")}
              </div>
            )}
            {!hasMore && (
              <p className="py-3 text-center text-[11px] text-muted-foreground">
                {t("list.end", { count: totalItems })}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
