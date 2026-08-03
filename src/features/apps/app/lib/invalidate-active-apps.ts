const EVENT = "submanager:active-apps-invalidate";

/** Notifica o menu lateral para recarregar a lista de apps ativos (após ativar/desativar). */
export function notifyActiveAppsMenuInvalidated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT));
}

export { EVENT as ACTIVE_APPS_INVALIDATE_EVENT };
