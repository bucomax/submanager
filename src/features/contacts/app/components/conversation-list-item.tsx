"use client";

import { STAGE_PILL_CLASS } from "@/features/contacts/app/utils/stage-colors";
import { Avatar, AvatarBadge, AvatarFallback } from "@/shared/components/ui/avatar";
import { cn } from "@/lib/utils";
import { relativeTimeLabel } from "@/lib/utils/date";
import { AtSign, MessageCircle, UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ConversationListItemDto } from "@/types/api/contacts-v1";

const CHANNEL_ICON = { whatsapp: MessageCircle, instagram: AtSign } as const;
const CHANNEL_COLOR = { whatsapp: "#25D366", instagram: "#E4405F" } as const;

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

type ConversationListItemProps = {
  conversation: ConversationListItemDto;
  active: boolean;
  onSelect: () => void;
};

export function ConversationListItem({ conversation, active, onSelect }: ConversationListItemProps) {
  const t = useTranslations("contacts");
  const locale = useLocale();
  const ChannelIcon = CHANNEL_ICON[conversation.channel];
  const registered = Boolean(conversation.clientId);
  const title = registered ? conversation.displayName : t("list.anonymous", { id: conversation.externalId.slice(-8) });
  const hasUnread = conversation.unreadCount > 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-2.5 border-b border-l-[3px] px-3 py-[11px] text-left transition-colors duration-150",
        active ? "border-l-foreground bg-accent" : "border-l-transparent hover:bg-row-hover",
      )}
    >
      <div className="relative shrink-0">
        <Avatar className="mt-0.5 size-[46px] bg-avatar">
          <AvatarFallback className="bg-transparent text-sm font-bold text-muted-foreground">
            {registered ? initialsFromName(conversation.displayName) : <UserRound className="size-[18px]" />}
          </AvatarFallback>
        </Avatar>
        <AvatarBadge className="size-[19px] bg-background p-0.5 shadow-[0_1px_4px_rgba(0,0,0,0.22)]">
          <ChannelIcon className="size-3" style={{ color: CHANNEL_COLOR[conversation.channel] }} />
        </AvatarBadge>
      </div>

      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-bold">{title}</p>
          {conversation.lastMessageAt && (
            <span
              className={cn(
                "shrink-0 text-[11px] tabular-nums",
                hasUnread ? "font-bold text-[#06a556]" : "text-muted-foreground",
              )}
            >
              {relativeTimeLabel(conversation.lastMessageAt, locale === "en" ? "en-US" : "pt-BR")}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className={cn("truncate text-[13px]", hasUnread ? "font-semibold text-foreground" : "text-muted-foreground")}>
            {conversation.lastMessagePreview}
          </p>
          {hasUnread && (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#06cf6b] px-1.5 text-[11px] font-extrabold text-[#06251a] shadow-[0_1px_3px_rgba(6,207,107,0.45)]">
              {conversation.unreadCount}
            </span>
          )}
        </div>

        <span
          className={cn(
            "inline-flex rounded-[6px] px-1.5 py-0.5 text-[10px] font-bold",
            STAGE_PILL_CLASS[conversation.status],
          )}
        >
          {t(`stage.${conversation.status}`)}
        </span>
      </div>
    </button>
  );
}
