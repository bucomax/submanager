/**
 * postMessage protocol between SubManager dashboard (host) and iframe apps.
 *
 * Host → Iframe:
 *   submanager:init       — context (tenant, user, locale, theme, token)
 *   submanager:theme      — theme changed
 *
 * Iframe → Host:
 *   submanager:navigate   — request navigation in the dashboard
 *   submanager:toast      — show a toast notification
 *   submanager:resize     — request container resize
 *   submanager:ready      — iframe signals it's ready to receive init
 *   submanager:token-request — iframe requests a fresh scoped token
 */

// ---------------------------------------------------------------------------
// Host → Iframe messages
// ---------------------------------------------------------------------------

export type SubManagerInitMessage = {
  type: "submanager:init";
  payload: {
    tenantId: string;
    userId: string;
    locale: string;
    theme: "light" | "dark";
    token: string | null;
    appSlug: string;
    version: 1;
  };
};

export type SubManagerThemeMessage = {
  type: "submanager:theme";
  payload: {
    theme: "light" | "dark";
  };
};

export type HostToIframeMessage = SubManagerInitMessage | SubManagerThemeMessage;

// ---------------------------------------------------------------------------
// Iframe → Host messages
// ---------------------------------------------------------------------------

export type SubManagerReadyMessage = {
  type: "submanager:ready";
};

export type SubManagerNavigateMessage = {
  type: "submanager:navigate";
  payload: {
    /** Path relative to dashboard root, e.g. "/dashboard/clients" */
    path: string;
  };
};

export type SubManagerToastMessage = {
  type: "submanager:toast";
  payload: {
    variant: "success" | "error" | "info" | "warning";
    message: string;
    duration?: number;
  };
};

export type SubManagerResizeMessage = {
  type: "submanager:resize";
  payload: {
    /** Desired height in pixels. 0 = auto (fill container). */
    height: number;
  };
};

export type SubManagerTokenRequestMessage = {
  type: "submanager:token-request";
};

export type IframeToHostMessage =
  | SubManagerReadyMessage
  | SubManagerNavigateMessage
  | SubManagerToastMessage
  | SubManagerResizeMessage
  | SubManagerTokenRequestMessage;

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

const VALID_IFRAME_TYPES = new Set([
  "submanager:ready",
  "submanager:navigate",
  "submanager:toast",
  "submanager:resize",
  "submanager:token-request",
]);

export function isIframeToHostMessage(data: unknown): data is IframeToHostMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    typeof (data as { type: unknown }).type === "string" &&
    VALID_IFRAME_TYPES.has((data as { type: string }).type)
  );
}
