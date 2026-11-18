import { ChevronsUpDown, UserPen, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { STAGE_PILL_CLASS } from "@/features/contacts/app/utils/stage-colors";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ConversationCardDto, ConversationStatus } from "@/types/api/contacts-v1";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

type ConversationChatHeaderProps = {
  conversation: ConversationCardDto;
  displayStatus: ConversationStatus;
  leadPanelOpen: boolean;
  onOpenLeadPanel: (openStagePicker?: boolean) => void;
  onCloseLeadPanel: () => void;
};

export function ConversationChatHeader({
  conversation,
  displayStatus,
  leadPanelOpen,
  onOpenLeadPanel,
  onCloseLeadPanel,
}: ConversationChatHeaderProps) {
  const t = useTranslations("contacts");

  return (
    <div className="flex min-h-[60px] items-center gap-2 border-b px-3.5">
      <Avatar size="sm">
        <AvatarFallback>
          {conversation.clientId ? initialsFromName(conversation.displayName) : <UserRound className="size-4" />}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{conversation.displayName}</p>
        <p className="truncate text-xs tabular-nums text-muted-foreground">
          {conversation.externalId} · #{conversation.id.slice(-8)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
        <button
          type="button"
          onClick={() => onOpenLeadPanel(true)}
          title={t("chat.changeStage")}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold",
            STAGE_PILL_CLASS[displayStatus],
          )}
        >
          {t(`stage.${displayStatus}`)}
          <ChevronsUpDown className="size-3" />
        </button>
        <button
          type="button"
          onClick={() => (leadPanelOpen ? onCloseLeadPanel() : onOpenLeadPanel())}
          className="flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium hover:bg-accent"
        >
          <UserPen className="size-3.5" />
          {leadPanelOpen ? t("chat.closeLead") : t("chat.editLead")}
        </button>
      </div>
    </div>
  );
}
