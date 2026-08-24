"use client";

import { MessageSquarePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/shared/components/ui/button";
import { useSidebar } from "@/shared/components/ui/sidebar";
import { FeedbackDialog } from "@/features/feedback/app/components/feedback-dialog";
import { useFeedbackDialogStore } from "@/features/feedback/app/hooks/use-feedback-dialog-store";

/**
 * Gatilho no rodapé da sidebar no desktop; botão flutuante quando a sidebar está
 * recolhida (ícones) ou em mobile, onde o `SidebarFooter` some da tela.
 * Depende de `useSidebar`, por isso só é montado dentro do `<Sidebar>` — a tela
 * de erro usa `<FeedbackDialog />` direto, sem este launcher.
 */
export function FeedbackLauncher() {
  const t = useTranslations("feedback.widget");
  const { state, isMobile } = useSidebar();
  const openDialog = useFeedbackDialogStore((s) => s.openDialog);
  const floating = isMobile || state === "collapsed";

  return (
    <>
      {floating ? (
        <FloatingTrigger label={t("trigger")} onOpen={() => openDialog()} />
      ) : (
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
      )}

      <FeedbackDialog />
    </>
  );
}

const noopSubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * Portal para `document.body`: este gatilho é filho do `SidebarFooter`, que tem
 * `group-data-[collapsible=icon]:hidden`. Um ancestral com `display: none`
 * esconde qualquer descendente `fixed` também — `position: fixed` não escapa
 * `display: none` de um pai — então o botão precisa sair dessa árvore via portal
 * para continuar visível com a sidebar recolhida ou em mobile.
 *
 * `useSyncExternalStore` (em vez de `useEffect` + `useState`) resolve o mount
 * gate exigido pelo SSR (`document` não existe no servidor) sem cair em
 * `react-hooks/set-state-in-effect`: no primeiro render do cliente ele já usa
 * `getServerSnapshot`, então não há hydration mismatch nem setState em effect.
 */
function FloatingTrigger({ label, onOpen }: { label: string; onOpen: () => void }) {
  const mounted = useSyncExternalStore(noopSubscribe, getClientSnapshot, getServerSnapshot);
  if (!mounted) return null;

  return createPortal(
    <Button
      type="button"
      size="icon"
      variant="secondary"
      aria-label={label}
      onClick={onOpen}
      className="fixed bottom-4 left-4 z-30 size-11 rounded-full shadow-lg"
    >
      <MessageSquarePlus className="size-5" />
    </Button>,
    document.body,
  );
}
