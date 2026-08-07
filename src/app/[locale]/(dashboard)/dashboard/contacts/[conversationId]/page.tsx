import { ConversationDetailPage } from "@/features/contacts/app/pages/conversation-detail-page";

type PageProps = {
  params: Promise<{ conversationId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { conversationId } = await params;
  return <ConversationDetailPage conversationId={conversationId} />;
}
