"use client";

import { useConversationDetail } from "@/features/contacts/app/hooks/use-conversation-detail";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { relativeTimeLabel } from "@/lib/utils/date";
import { ArrowLeft } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { MessageDto } from "@/types/api/contacts-v1";

type ConversationDetailPanelProps = {
  conversationId: string;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

function MessageBubble({ message, locale }: { message: MessageDto; locale: string }) {
  const isOutbound = message.direction === "outbound";
  return (
    <div className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-lg px-3 py-2 text-sm",
          isOutbound ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        <p className="whitespace-pre-wrap">{message.body}</p>
        <p
          className={cn(
            "mt-1 text-right text-[10px]",
            isOutbound ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          {relativeTimeLabel(message.createdAt, locale === "en" ? "en-US" : "pt-BR")}
        </p>
      </div>
    </div>
  );
}

export function ConversationDetailPanel({ conversationId }: ConversationDetailPanelProps) {
  const t = useTranslations("contacts.detail");
  const locale = useLocale();
  const { data, loading, error, refresh } = useConversationDetail(conversationId);

  return (
    <div className="flex h-[calc(100vh-14rem)] flex-col rounded-xl border">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Link
          href="/dashboard/contacts"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </Link>

        {loading ? (
          <Skeleton className="h-6 w-40" />
        ) : data ? (
          <div className="flex min-w-0 items-center gap-2">
            <Avatar size="sm">
              <AvatarFallback>{initialsFromName(data.conversation.displayName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{data.conversation.displayName}</p>
              {data.conversation.clientName && (
                <p className="truncate text-xs text-primary">{data.conversation.clientName}</p>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="ml-auto h-10 w-1/2" />
            <Skeleton className="h-8 w-1/3" />
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">{t("loadError")}</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="text-sm font-medium text-primary hover:underline"
            >
              {t("retry")}
            </button>
          </div>
        ) : data && data.messages.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          data?.messages.map((message) => (
            <MessageBubble key={message.id} message={message} locale={locale} />
          ))
        )}
      </div>

      <div className="space-y-2 border-t p-3">
        <Badge variant="secondary" className="w-fit">
          {t("demoBadge")}
        </Badge>
        <div className="flex items-center gap-2">
          <Input placeholder={t("composerPlaceholder")} disabled className="flex-1" />
          <Button type="button" size="sm" disabled>
            {t("send")}
          </Button>
        </div>
      </div>
    </div>
  );
}
