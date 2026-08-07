import { ContactsKanbanBoard } from "@/features/contacts/app/components/contacts-kanban-board";
import { DashboardPage } from "@/shared/components/layout/dashboard-page";
import { getTranslations } from "next-intl/server";

export async function ContactsPage() {
  const t = await getTranslations("contacts.page");

  return (
    <DashboardPage title={t("title")} description={t("description")}>
      <ContactsKanbanBoard />
    </DashboardPage>
  );
}
