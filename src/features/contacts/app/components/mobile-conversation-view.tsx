"use client";

import { useState } from "react";
import { ConversationChat } from "@/features/contacts/app/components/conversation-chat";
import { LeadPanel } from "@/features/contacts/app/components/lead-panel";
import { useConversationDetail } from "@/features/contacts/app/hooks/use-conversation-detail";
import { updateConversationStatus } from "@/features/contacts/app/services/contacts.service";
import { Sheet, SheetContent, SheetTitle } from "@/shared/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { Link } from "@/i18n/navigation";
import { toast } from "@/lib/toast";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ConversationStatus } from "@/types/api/contacts-v1";

type MobileConversationViewProps = {
  conversationId: string;
};

/** Fallback <1024px: chat em tela cheia; painel do lead abre como Sheet lateral. */
export function MobileConversationView({ conversationId }: MobileConversationViewProps) {
  const t = useTranslations("contacts");
  const { data, refresh } = useConversationDetail(conversationId);
  const [leadPanelOpen, setLeadPanelOpen] = useState(false);
  const [stagePickerOpen, setStagePickerOpen] = useState(false);

  async function handleStageChange(status: ConversationStatus) {
    try {
      await updateConversationStatus(conversationId, status);
      await refresh();
      toast.success(t("stage.changed", { stage: t(`stage.${status}`) }));
    } catch {
      toast.error(t("chat.sendError"));
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <Link
                href="/dashboard/contacts"
                aria-label={t("list.back")}
                className="flex size-8 items-center justify-center rounded-md hover:bg-accent"
              >
                <ArrowLeft className="size-4" />
              </Link>
            }
          />
          <TooltipContent>{t("list.back")}</TooltipContent>
        </Tooltip>
      </div>
      <div className="min-h-0 flex-1">
        <ConversationChat
          conversationId={conversationId}
          leadPanelOpen={leadPanelOpen}
          onOpenLeadPanel={(openStage) => {
            setLeadPanelOpen(true);
            if (openStage) setStagePickerOpen(true);
          }}
          onCloseLeadPanel={() => setLeadPanelOpen(false)}
          stageOverride={data?.conversation.status}
        />
      </div>

      <Sheet open={leadPanelOpen} onOpenChange={setLeadPanelOpen}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-[376px]" showCloseButton={false}>
          <SheetTitle className="sr-only">Lead</SheetTitle>
          {data && (
            <LeadPanel
              open={leadPanelOpen}
              onClose={() => setLeadPanelOpen(false)}
              conversation={data.conversation}
              stageChangedAt={data.conversation.stageChangedAt}
              stagePickerOpen={stagePickerOpen}
              onStagePickerOpenChange={setStagePickerOpen}
              onStageChange={handleStageChange}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
