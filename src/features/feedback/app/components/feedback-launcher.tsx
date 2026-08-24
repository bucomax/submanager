"use client";

import { MessageSquarePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/shared/components/ui/button";
import { useSidebar } from "@/shared/components/ui/sidebar";
import { FeedbackDialog } from "@/features/feedback/app/components/feedback-dialog";
import { useFeedbackDialogStore } from "@/features/feedback/app/hooks/use-feedback-dialog-store";

/**
 * Gatilho de rodapé: só existe visualmente com a sidebar expandida no desktop.
 * Monta dentro do `SidebarFooter` (que tem `group-data-[collapsible=icon]:hidden`
 * — some corretamente com a sidebar recolhida) e não renderiza nada quando
 * `floating` é true, porque nesse caso o `FeedbackFloatingWidget` assume.
 */
export function FeedbackFooterTrigger() {
  const t = useTranslations("feedback.widget");
  const { state, isMobile } = useSidebar();
  const openDialog = useFeedbackDialogStore((s) => s.openDialog);
  const floating = isMobile || state === "collapsed";

  if (floating) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => openDialog()}
      className="h-auto w-full justify-start gap-2 px-2 py-2"
    >
      <MessageSquarePlus className="size-4 shrink-0" />
      <span className="truncate">{t("trigger")}</span>
    </Button>
  );
}

/**
 * Botão flutuante + `FeedbackDialog`: montado como irmão de `<AppSidebar />`
 * dentro do `<SidebarProvider>` (em `AppShell`), não dentro da árvore da
 * sidebar. Motivo: no mobile, `Sidebar` renderiza os filhos dentro de um
 * `<Sheet>` (`sidebar.tsx`) cujo `SheetContent`/`SheetPortal` não usa
 * `keepMounted` — com o menu fechado (estado padrão), nada dentro de
 * `<AppSidebar />` existe no DOM, então um botão flutuante montado ali dentro
 * ficaria inalcançável mesmo com `position: fixed`. Montando aqui, fora dessa
 * árvore, o botão e o dialog existem independente do estado do sheet/sidebar.
 *
 * Isso também dispensa o portal para `document.body` e o gate de mount que a
 * versão anterior precisava só para escapar do `SidebarFooter` — sem ancestral
 * `display: none` no caminho, `position: fixed` funciona direto.
 */
export function FeedbackFloatingWidget() {
  const t = useTranslations("feedback.widget");
  const { state, isMobile } = useSidebar();
  const openDialog = useFeedbackDialogStore((s) => s.openDialog);
  const floating = isMobile || state === "collapsed";

  return (
    <>
      {floating ? (
        <Button
          type="button"
          size="icon"
          variant="secondary"
          aria-label={t("trigger")}
          onClick={() => openDialog()}
          className="fixed bottom-4 left-4 z-30 size-11 rounded-full shadow-lg"
        >
          <MessageSquarePlus className="size-5" />
        </Button>
      ) : null}

      <FeedbackDialog />
    </>
  );
}
