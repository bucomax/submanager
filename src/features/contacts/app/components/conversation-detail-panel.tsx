"use client";

import { useConversationDetail } from "@/features/contacts/app/hooks/use-conversation-detail";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { ArrowLeft, Check, CheckCheck, Send } from "lucide-react";
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

function bubbleTime(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Rótulo do separador de data: "Hoje" / "Ontem" / data por extenso, como no WhatsApp. */
function dateSeparatorLabel(iso: string, locale: string, t: ReturnType<typeof useTranslations>): string {
  const date = new Date(iso);
  const now = new Date();
  if (isSameLocalDay(date, now)) return t("today");

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameLocalDay(date, yesterday)) return t("yesterday");

  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pt-BR", {
    day: "2-digit",
    month: "long",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  }).format(date);
}

function DeliveryTicks({ status }: { status: MessageDto["status"] }) {
  if (status === "failed") return null;
  const read = status === "read";
  const Icon = status === "sent" ? Check : CheckCheck;
  return (
    <Icon
      className={cn("size-3.5 shrink-0", read ? "text-sky-400" : "text-current opacity-60")}
      aria-hidden
    />
  );
}

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="animate-chat-date-pill sticky top-2 z-10 my-3 flex justify-center">
      <span className="rounded-full bg-black/[0.06] px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm dark:bg-white/[0.08]">
        {label}
      </span>
    </div>
  );
}

function MessageBubble({ message, locale }: { message: MessageDto; locale: string }) {
  const isOutbound = message.direction === "outbound";
  return (
    <div className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] overflow-hidden rounded-2xl px-3 py-2 text-[14px] shadow-sm",
          isOutbound
            ? cn(
                "animate-chat-bubble-out rounded-br-md",
                "bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]",
              )
            : cn(
                "animate-chat-bubble-in rounded-bl-md",
                "bg-white text-[#111b21] dark:bg-[#202c33] dark:text-[#e9edef]",
              ),
        )}
      >
        <p className="whitespace-pre-wrap leading-[1.4]">{message.body}</p>
        <div
          className={cn(
            "mt-1 flex items-center justify-end gap-1 text-[11px] leading-none tabular-nums",
            isOutbound ? "text-[#111b21]/55 dark:text-[#e9edef]/60" : "text-muted-foreground",
          )}
        >
          <time dateTime={message.createdAt}>{bubbleTime(message.createdAt, locale)}</time>
          {isOutbound && <DeliveryTicks status={message.status} />}
        </div>
      </div>
    </div>
  );
}

export function ConversationDetailPanel({ conversationId }: ConversationDetailPanelProps) {
  const t = useTranslations("contacts.detail");
  const locale = useLocale();
  const { data, loading, error, refresh } = useConversationDetail(conversationId);

  let lastDateKey: string | null = null;

  return (
    <div className="flex h-[calc(100vh-14rem)] flex-col overflow-hidden rounded-xl border">
      <div className="flex items-center gap-3 border-b bg-background px-4 py-3">
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

      <div
        className={cn(
          "flex-1 space-y-1.5 overflow-y-auto p-4",
          "bg-[#f0f2f5] bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.035)_1px,transparent_0)] bg-[length:18px_18px]",
          "dark:bg-[#0b141a] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.035)_1px,transparent_0)]",
        )}
      >
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
          data?.messages.map((message) => {
            const dateKey = message.createdAt.slice(0, 10);
            const showSeparator = dateKey !== lastDateKey;
            lastDateKey = dateKey;
            return (
              <div key={message.id}>
                {showSeparator && (
                  <DateSeparator label={dateSeparatorLabel(message.createdAt, locale, t)} />
                )}
                <MessageBubble message={message} locale={locale} />
              </div>
            );
          })
        )}
      </div>

      <div className="space-y-2 border-t bg-background p-3">
        <Badge variant="secondary" className="w-fit">
          {t("demoBadge")}
        </Badge>
        <div className="flex items-center gap-2">
          <Input placeholder={t("composerPlaceholder")} disabled className="flex-1 rounded-full" />
          <button
            type="button"
            disabled
            aria-label={t("send")}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-50"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
