"use client";

import { cn } from "@/lib/utils";
import { Paperclip, Plus, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import type { QuickPhraseDto } from "@/types/api/contacts-v1";

type QuickPhrasePopoverProps = {
  phrases: QuickPhraseDto[];
  activeIndex: number;
  onHoverIndex: (index: number) => void;
  onSelect: (phrase: QuickPhraseDto) => void;
  onCreateFromDraft: () => void;
};

const COMMAND_SLUGS = new Set(["agendar", "notas"]);

/** Popover do "/" no composer — abre quando o rascunho casa `^\/[^\s]*$`. */
export function QuickPhrasePopover({
  phrases,
  activeIndex,
  onHoverIndex,
  onSelect,
  onCreateFromDraft,
}: QuickPhrasePopoverProps) {
  const t = useTranslations("contacts.phrases");

  return (
    <div className="animate-pop-in absolute inset-x-[14px] bottom-[calc(100%-6px)] z-20 max-h-80 overflow-y-auto rounded-xl border bg-card shadow-[0_12px_32px_rgba(0,0,0,0.18)]">
      <div className="flex items-center gap-1.5 border-b px-2.5 py-2">
        <Zap className="size-3.5" aria-hidden />
        <span className="text-[11px] font-extrabold tracking-wide uppercase">{t("title")}</span>
        <span className="ml-auto text-[11px] text-muted-foreground">{t("hintNavigate")}</span>
      </div>

      {phrases.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul>
          {phrases.map((phrase, i) => (
            <li key={phrase.id}>
              <button
                type="button"
                onMouseEnter={() => onHoverIndex(i)}
                onClick={() => onSelect(phrase)}
                className={cn(
                  "flex w-full flex-col gap-0.5 rounded-md px-2.5 py-2 text-left",
                  i === activeIndex && "bg-accent",
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-bold">
                    /{phrase.slug}
                  </span>
                  <span className="text-[13px] font-bold">{phrase.title}</span>
                  {COMMAND_SLUGS.has(phrase.slug) && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {t("command")}
                    </span>
                  )}
                  {/\{\{[a-z]+\}\}/.test(phrase.body) && (
                    <span className="rounded bg-[#ecfdf5] px-1.5 py-0.5 text-[10px] font-semibold text-[#047857] dark:bg-emerald-950 dark:text-emerald-400">
                      {t("variables")}
                    </span>
                  )}
                  {phrase.attachment && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Paperclip className="size-2.5" />
                      {phrase.attachment}
                    </span>
                  )}
                </span>
                <span className="truncate text-xs text-muted-foreground">{phrase.body}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onCreateFromDraft}
        className="flex w-full items-center gap-1.5 border-t px-2.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <Plus className="size-3.5" />
        {t("createFromDraft")}
      </button>
    </div>
  );
}
