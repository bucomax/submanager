import { MobileConversationView } from "@/features/contacts/app/components/mobile-conversation-view";

type ConversationDetailPageProps = {
  conversationId: string;
};

/** Fallback mobile (<1024px) da tela de Conversas — a rota `/dashboard/contacts/[id]`. */
export async function ConversationDetailPage({ conversationId }: ConversationDetailPageProps) {
  return <MobileConversationView conversationId={conversationId} />;
}
