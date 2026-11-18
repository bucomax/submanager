import { Paperclip, Send, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import type { KeyboardEvent, RefObject } from "react";
import { QuickPhrasePopover } from "@/features/contacts/app/components/quick-phrase-popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import type { QuickPhraseDto } from "@/types/api/contacts-v1";

type ConversationComposerBarProps = {
  composerRef: RefObject<HTMLDivElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  draft: string;
  attachment: string | null;
  popoverOpen: boolean;
  filteredPhrases: QuickPhraseDto[];
  slashIndex: number;
  onSlashIndexChange: (index: number) => void;
  onDraftChange: (draft: string) => void;
  onSlashDismissedChange: (dismissed: boolean) => void;
  onAttachmentChange: (name: string | null) => void;
  onSelectPhrase: (phrase: QuickPhraseDto) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
};

/** Barra de composição do chat: botões de frases/anexo, textarea e envio, com o popover de `/` comandos. */
export function ConversationComposerBar({
  composerRef,
  fileInputRef,
  draft,
  attachment,
  popoverOpen,
  filteredPhrases,
  slashIndex,
  onSlashIndexChange,
  onDraftChange,
  onSlashDismissedChange,
  onAttachmentChange,
  onSelectPhrase,
  onKeyDown,
  onSend,
}: ConversationComposerBarProps) {
  const t = useTranslations("contacts");

  return (
    <div ref={composerRef} className="relative border-t bg-background p-[10px_14px_14px]">
      {popoverOpen && (
        <QuickPhrasePopover
          phrases={filteredPhrases}
          activeIndex={Math.min(slashIndex, Math.max(filteredPhrases.length - 1, 0))}
          onHoverIndex={onSlashIndexChange}
          onSelect={onSelectPhrase}
          onCreateFromDraft={() => onDraftChange("")}
        />
      )}
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={() => {
                  onDraftChange("/");
                  onSlashDismissedChange(false);
                }}
                className="flex size-[38px] shrink-0 items-center justify-center rounded-full border hover:bg-accent"
              >
                <Zap className="size-4" />
              </button>
            }
          />
          <TooltipContent>{t("chat.phrases")}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex size-[38px] shrink-0 items-center justify-center rounded-full border hover:bg-accent"
              >
                <Paperclip className="size-4" />
              </button>
            }
          />
          <TooltipContent>{t("chat.attach")}</TooltipContent>
        </Tooltip>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => onAttachmentChange(e.target.files?.[0]?.name ?? null)}
        />
        <textarea
          value={draft}
          onChange={(e) => {
            onDraftChange(e.target.value);
            onSlashDismissedChange(false);
          }}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder={t("chat.composerPlaceholder")}
          className="max-h-[120px] min-h-[38px] flex-1 resize-none rounded-[10px] border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={onSend}
                disabled={!draft.trim()}
                className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
              >
                <Send className="size-4" />
              </button>
            }
          />
          <TooltipContent>{t("chat.send")}</TooltipContent>
        </Tooltip>
      </div>
      {attachment && <p className="mt-1.5 text-xs text-muted-foreground">{attachment}</p>}
    </div>
  );
}
