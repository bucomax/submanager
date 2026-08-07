"use client";

import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Link } from "@/i18n/navigation";
import { relativeTimeLabel } from "@/lib/utils/date";
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

export function ConversationCard({ conversation }: ConversationCardProps) {
  const t = useTranslations("contacts.card");
  const locale = useLocale();
  const ChannelIcon = CHANNEL_ICON[conversation.channel];

  return (
    <Link href={`/dashboard/contacts/${conversation.id}`} className="block">
      <Card className="transition-shadow hover:shadow-md">
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
              <p className="truncate text-xs text-muted-foreground">
                {conversation.lastMessagePreview}
              </p>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
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
    </Link>
  );
}
