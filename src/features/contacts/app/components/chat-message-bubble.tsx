"use client";

import { cn } from "@/lib/utils";
import { Check, CheckCheck } from "lucide-react";
import type { useTranslations } from "next-intl";
import type { MessageDto } from "@/types/api/contacts-v1";

export function bubbleTime(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Rótulo do separador de data: "Hoje" / "Ontem" / data por extenso, como no WhatsApp. */
export function dateSeparatorLabel(
  iso: string,
  locale: string,
  t: ReturnType<typeof useTranslations>,
): string {
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

export function DeliveryTicks({ status }: { status: MessageDto["status"] }) {
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

export function DateSeparator({ label }: { label: string }) {
  return (
    <div className="animate-chat-date-pill sticky top-2 z-10 my-3 flex justify-center">
      <span className="rounded-full bg-black/[0.06] px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm dark:bg-white/[0.08]">
        {label}
      </span>
    </div>
  );
}

export function ChatMessageBubble({ message, locale }: { message: MessageDto; locale: string }) {
  const isOutbound = message.direction === "outbound";
  const failed = message.status === "failed";
  return (
    <div className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[72%] overflow-hidden rounded-2xl px-[11px] py-[7px] text-[14px] shadow-[0_1px_1px_rgba(0,0,0,0.08)]",
          isOutbound
            ? cn(
                "animate-chat-bubble-out rounded-br-md",
                failed
                  ? "bg-destructive/10 text-destructive dark:bg-destructive/20"
                  : "bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]",
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
            "mt-1 flex items-center justify-end gap-1 text-[11px] leading-none tabular-nums opacity-60",
            isOutbound ? "text-[#111b21] dark:text-[#e9edef]" : "text-muted-foreground",
          )}
        >
          <time dateTime={message.createdAt}>{bubbleTime(message.createdAt, locale)}</time>
          {isOutbound && <DeliveryTicks status={message.status} />}
        </div>
      </div>
    </div>
  );
}
