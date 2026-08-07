import { ConversationDetailPanel } from "@/features/contacts/app/components/conversation-detail-panel";
import { DashboardPage } from "@/shared/components/layout/dashboard-page";
import { getTranslations } from "next-intl/server";

type ConversationDetailPageProps = {
  conversationId: string;
};

export async function ConversationDetailPage({ conversationId }: ConversationDetailPageProps) {
  const t = await getTranslations("contacts.page");

  return (
    <DashboardPage title={t("title")}>
      <ConversationDetailPanel conversationId={conversationId} />
    </DashboardPage>
  );
}
