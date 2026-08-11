"use client";

import { useState } from "react";
import { ConversationChat } from "@/features/contacts/app/components/conversation-chat";
import { ConversationList } from "@/features/contacts/app/components/conversation-list";
import { LeadPanel } from "@/features/contacts/app/components/lead-panel";
import { QuickPhraseManagerDrawer } from "@/features/contacts/app/components/quick-phrase-manager-drawer";
import { updateConversationStatus } from "@/features/contacts/app/services/contacts.service";
import { useRouter } from "@/i18n/navigation";
import { toast } from "@/lib/toast";
import { useTranslations } from "next-intl";
import type { ConversationListItemDto, ConversationStatus } from "@/types/api/contacts-v1";

const MOBILE_BREAKPOINT_PX = 1024;
const LEAD_PANEL_WIDTH_PX = 376;
const LIST_COLUMN = "minmax(320px,376px)";
const CHAT_COLUMN = "minmax(420px,1fr)";

/** Tela de Conversas — 3 colunas (Layout B): lista, chat, painel do lead à direita. */
export function ConversationsPage() {
  const t = useTranslations("contacts");
  const router = useRouter();

  const [activeConversation, setActiveConversation] = useState<ConversationListItemDto | null>(null);
  const [leadPanelOpen, setLeadPanelOpen] = useState(false);
  const [stagePickerOpen, setStagePickerOpen] = useState(false);
  const [phrasesDrawerOpen, setPhrasesDrawerOpen] = useState(false);
  const [phrasesDraft, setPhrasesDraft] = useState<string | undefined>(undefined);

  function handleSelectConversation(item: ConversationListItemDto) {
    if (typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT_PX) {
      router.push(`/dashboard/contacts/${item.id}`);
      return;
    }
    setActiveConversation(item);
    setLeadPanelOpen(false);
    setStagePickerOpen(false);
  }

  function openLeadPanel(openStagePicker?: boolean) {
    setLeadPanelOpen(true);
    if (openStagePicker) setStagePickerOpen(true);
  }

  async function handleStageChange(status: ConversationStatus) {
    if (!activeConversation) return;
    try {
      await updateConversationStatus(activeConversation.id, status);
      setActiveConversation((prev) =>
        prev ? { ...prev, status, stageChangedAt: new Date().toISOString() } : prev,
      );
      toast.success(t("stage.changed", { stage: t(`stage.${status}`) }));
    } catch {
      toast.error(t("chat.sendError"));
    }
  }

  return (
    <div className="h-[calc(100vh-8rem)] min-h-0 rounded-xl border">
      {/* Desktop / tablet largo (Layout B): grid de 3 colunas, painel do lead como 3ª coluna animada. */}
      <div
        className="hidden h-full min-h-0 overflow-x-auto lg:grid"
        style={{
          gridTemplateColumns: `${LIST_COLUMN} ${CHAT_COLUMN} ${leadPanelOpen ? LEAD_PANEL_WIDTH_PX : 0}px`,
          transition: "grid-template-columns .34s cubic-bezier(.22,1,.36,1)",
        }}
      >
        <div className="col-start-1 row-start-1 min-h-0 min-w-0 overflow-hidden border-r">
          <ConversationList
            activeConversationId={activeConversation?.id ?? null}
            onSelectConversation={handleSelectConversation}
            onOpenPhrasesDrawer={() => {
              setPhrasesDraft(undefined);
              setPhrasesDrawerOpen(true);
            }}
          />
        </div>

        <div className="col-start-2 row-start-1 min-h-0 min-w-0 overflow-hidden">
          {activeConversation ? (
            <ConversationChat
              key={activeConversation.id}
              conversationId={activeConversation.id}
              leadPanelOpen={leadPanelOpen}
              onOpenLeadPanel={openLeadPanel}
              onCloseLeadPanel={() => setLeadPanelOpen(false)}
              stageOverride={activeConversation.status}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t("chat.selectPrompt")}
            </div>
          )}
        </div>

        <div
          className="col-start-3 row-start-1 min-h-0 min-w-0 overflow-hidden"
          style={{
            transform: leadPanelOpen ? "translateX(0)" : "translateX(100%)",
            opacity: leadPanelOpen ? 1 : 0,
            pointerEvents: leadPanelOpen ? "auto" : "none",
            transition: "transform .34s cubic-bezier(.22,1,.36,1), opacity .26s ease",
          }}
        >
          {activeConversation && (
            <LeadPanel
              open={leadPanelOpen}
              onClose={() => setLeadPanelOpen(false)}
              conversation={activeConversation}
              stageChangedAt={activeConversation.stageChangedAt}
              stagePickerOpen={stagePickerOpen}
              onStagePickerOpenChange={setStagePickerOpen}
              onStageChange={handleStageChange}
            />
          )}
        </div>
      </div>

      {/* Mobile: só a lista; selecionar navega para /dashboard/contacts/[id] em tela cheia. */}
      <div className="h-full min-h-0 lg:hidden">
        <ConversationList
          activeConversationId={null}
          onSelectConversation={handleSelectConversation}
          onOpenPhrasesDrawer={() => {
            setPhrasesDraft(undefined);
            setPhrasesDrawerOpen(true);
          }}
        />
      </div>

      <QuickPhraseManagerDrawer
        open={phrasesDrawerOpen}
        onOpenChange={setPhrasesDrawerOpen}
        initialDraft={phrasesDraft}
      />
    </div>
  );
}
