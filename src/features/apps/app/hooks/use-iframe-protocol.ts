"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "@/i18n/navigation";
import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import { toast } from "@/lib/toast";
import type {
  SubManagerInitMessage,
  HostToIframeMessage,
  IframeToHostMessage,
} from "@/features/apps/app/types/iframe-protocol";
import { isIframeToHostMessage } from "@/features/apps/app/types/iframe-protocol";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UseIframeProtocolOptions = {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  iframeUrl: string;
  appSlug: string;
  /** Scoped token for the iframe (null if not yet generated) */
  token?: string | null;
  /** Called when the iframe requests a new token */
  onTokenRequest?: () => void;
  /** Called when the iframe requests a resize */
  onResize?: (height: number) => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useIframeProtocol({
  iframeRef,
  iframeUrl,
  appSlug,
  token = null,
  onTokenRequest,
  onResize,
}: UseIframeProtocolOptions) {
  const { data: session } = useSession();
  const locale = useLocale();
  const router = useRouter();
  const expectedOrigin = extractOrigin(iframeUrl);
  const initSentRef = useRef(false);

  // -- Send a message to the iframe ------------------------------------------

  const postToIframe = useCallback(
    (message: HostToIframeMessage) => {
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow || !expectedOrigin) return;
      iframe.contentWindow.postMessage(message, expectedOrigin);
    },
    [iframeRef, expectedOrigin],
  );

  // -- Send init context -----------------------------------------------------

  const sendInit = useCallback(() => {
    const user = session?.user;
    if (!user) return;

    const message: SubManagerInitMessage = {
      type: "submanager:init",
      payload: {
        tenantId: user.tenantId ?? "",
        userId: user.id,
        locale,
        theme: "light",
        token,
        appSlug,
        version: 1,
      },
    };

    postToIframe(message);
    initSentRef.current = true;
  }, [session, locale, token, appSlug, postToIframe]);

  // -- Handle incoming messages from the iframe ------------------------------

  useEffect(() => {
    if (!expectedOrigin) return;

    function handleMessage(event: MessageEvent) {
      // Validate origin
      if (event.origin !== expectedOrigin) return;

      // Validate message shape
      if (!isIframeToHostMessage(event.data)) return;

      const msg: IframeToHostMessage = event.data;

      switch (msg.type) {
        case "submanager:ready":
          // Iframe signals it's ready — send init
          sendInit();
          break;

        case "submanager:navigate":
          if (msg.payload.path && msg.payload.path.startsWith("/")) {
            router.push(msg.payload.path);
          }
          break;

        case "submanager:toast":
          switch (msg.payload.variant) {
            case "success":
              toast.success(msg.payload.message);
              break;
            case "error":
              toast.error(msg.payload.message);
              break;
            case "info":
              toast.info(msg.payload.message);
              break;
            case "warning":
              toast.warning(msg.payload.message);
              break;
          }
          break;

        case "submanager:resize":
          onResize?.(msg.payload.height);
          break;

        case "submanager:token-request":
          onTokenRequest?.();
          break;
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [expectedOrigin, sendInit, router, onResize, onTokenRequest]);

  // -- Send init after iframe loads (fallback for iframes that don't send ready)

  const handleIframeLoad = useCallback(() => {
    // Small delay to let iframe JS initialize
    setTimeout(() => {
      if (!initSentRef.current) {
        sendInit();
      }
    }, 500);
  }, [sendInit]);

  // Reset init flag when URL changes
  useEffect(() => {
    initSentRef.current = false;
  }, [iframeUrl]);

  return {
    handleIframeLoad,
    postToIframe,
    sendInit,
  };
}
