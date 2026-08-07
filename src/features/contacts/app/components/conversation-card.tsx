"use client";

import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent } from "@/shared/components/ui/card";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { relativeTimeLabel } from "@/lib/utils/date";
import { useDraggable } from "@dnd-kit/core";
import { AtSign, MessageCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ConversationCardDto } from "@/types/api/contacts-v1";

type ConversationCardProps = {
  conversation: ConversationCardDto;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

const CHANNEL_ICON = {
  whatsapp: MessageCircle,
  instagram: AtSign,
} as const;

const CHANNEL_BADGE_CLASS = {
  whatsapp:
    "border-emerald-800 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  instagram: "border-transparent bg-transparent text-muted-foreground",
} as const;

/** Conteúdo visual puro, compartilhado entre o card na lista e o preview no `DragOverlay`. */
function ConversationCardBody({
  conversation,
  className,
}: ConversationCardProps & { className?: string }) {
  const t = useTranslations("contacts.card");
  const locale = useLocale();
  const ChannelIcon = CHANNEL_ICON[conversation.channel];

  return (
    <Card className={cn("transition-shadow hover:shadow-md", className)}>
      <CardContent className="flex items-start gap-3 p-3">
        <Avatar size="sm" className="mt-0.5 shrink-0">
          <AvatarFallback>{initialsFromName(conversation.displayName)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium">{conversation.displayName}</p>
            {conversation.unreadCount > 0 && (
              <Badge variant="default" className="shrink-0 rounded-full px-1.5">
                {conversation.unreadCount}
              </Badge>
            )}
          </div>

          {conversation.lastMessagePreview && (
            <p className="truncate text-xs text-muted-foreground">{conversation.lastMessagePreview}</p>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                CHANNEL_BADGE_CLASS[conversation.channel],
              )}
            >
              <ChannelIcon className="size-3" />
              {t(`channel.${conversation.channel}`)}
            </span>
            {conversation.lastMessageAt && (
              <span className="text-xs text-muted-foreground">
                {relativeTimeLabel(conversation.lastMessageAt, locale === "en" ? "en-US" : "pt-BR")}
              </span>
            )}
          </div>

          {conversation.clientName && (
            <p className="truncate text-xs text-primary">{conversation.clientName}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ConversationCard({ conversation }: ConversationCardProps) {
  const router = useRouter();

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: conversation.id,
  });

  return (
    <div
      ref={setNodeRef}
      onClick={() => router.push(`/dashboard/contacts/${conversation.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/dashboard/contacts/${conversation.id}`);
      }}
      className="touch-none"
      {...listeners}
      {...attributes}
    >
      <ConversationCardBody
        conversation={conversation}
        className={cn("cursor-grab active:cursor-grabbing", isDragging && "opacity-40")}
      />
    </div>
  );
}

/** Cópia flutuante renderizada no `DragOverlay` — fora do fluxo da coluna, sempre por cima. */
export function ConversationCardOverlay({ conversation }: ConversationCardProps) {
  return (
    <div className="w-[min(280px,calc(100vw-2rem))]">
      <ConversationCardBody conversation={conversation} className="cursor-grabbing shadow-lg" />
    </div>
  );
}
