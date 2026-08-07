"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, Construction, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import type { AppDetailResponseData } from "@/types/api/apps-v1";
import { useIframeProtocol } from "@/features/apps/app/hooks/use-iframe-protocol";
import { getAppScopedToken } from "@/features/apps/app/services/apps.service";

// Internal app components
import { WhatsAppSettingsCard } from "@/features/settings/app/components/whatsapp-settings-card";

/** Registry of internal app components by slug */
const INTERNAL_APPS: Record<string, React.ComponentType> = {
  "whatsapp-business": WhatsAppSettingsCard,
};

const IFRAME_TIMEOUT_MS = 15_000;

type Props = {
  app: AppDetailResponseData;
};

export function AppViewer({ app }: Props) {
  const { data: session } = useSession();
  const locale = useLocale();
  const t = useTranslations("apps.detail");

  const iframeUrl = useMemo(() => {
    if (app.renderMode !== "iframe" || !app.iframeBaseUrl) return null;

    let url = app.iframeBaseUrl;
    url = url.replace(/\{\{tenantId\}\}/g, session?.user?.tenantId ?? "");
    url = url.replace(/\{\{userId\}\}/g, session?.user?.id ?? "");
    url = url.replace(/\{\{locale\}\}/g, locale);
    url = url.replace(/\{\{theme\}\}/g, "light");
    return url;
  }, [app.iframeBaseUrl, app.renderMode, session?.user?.tenantId, session?.user?.id, locale]);

  // ── Internal mode ──────────────────────────────────────────────────
  if (app.renderMode === "internal") {
    const InternalComponent = INTERNAL_APPS[app.slug];
    if (InternalComponent) {
      return <InternalComponent />;
    }
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border bg-muted/30 py-16">
        <p className="text-sm text-muted-foreground">{t("internalNotFound")}</p>
      </div>
    );
  }

  // ── External link mode ─────────────────────────────────────────────
  if (app.renderMode === "external_link" && app.iframeBaseUrl) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border bg-muted/30 py-16">
        <p className="text-sm text-muted-foreground">{app.tagline ?? app.name}</p>
        <a href={app.iframeBaseUrl} target="_blank" rel="noopener noreferrer">
          <Button>
            <ExternalLink className="size-4" />
            {t("openExternal")}
          </Button>
        </a>
      </div>
    );
  }

  // ── Iframe mode ────────────────────────────────────────────────────
  if (app.renderMode === "iframe" && iframeUrl) {
    return <IframeViewer url={iframeUrl} title={app.name} appId={app.id} appSlug={app.slug} t={t} />;
  }

  // ── Sem destino configurado ainda (iframeBaseUrl vazio) ─────────────
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/30 py-16 text-center">
      <Construction className="size-8 text-muted-foreground" />
      <p className="text-sm font-medium">{t("comingSoon")}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{t("comingSoonHint")}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Iframe viewer (separate component to isolate state)
// ---------------------------------------------------------------------------

function IframeViewer({
  url,
  title,
  appId,
  appSlug,
  t,
}: {
  url: string;
  title: string;
  appId: string;
  appSlug: string;
  t: (key: "loadingApp" | "iframeError" | "iframeErrorHint" | "retry") => string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  const [scopedToken, setScopedToken] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch scoped token
  const fetchToken = useCallback(async () => {
    try {
      const { token } = await getAppScopedToken(appId);
      setScopedToken(token);
    } catch {
      // Non-critical — iframe works without token
    }
  }, [appId]);

  const { handleIframeLoad: protocolOnLoad } = useIframeProtocol({
    iframeRef,
    iframeUrl: url,
    appSlug,
    token: scopedToken,
    onTokenRequest: fetchToken,
    onResize: (height) => setContainerHeight(height > 0 ? height : null),
  });

  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      setError(true);
    }, IFRAME_TIMEOUT_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [url]);

  const handleLoad = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setLoading(false);
    setError(false);
    // Fetch token then send init to iframe
    void fetchToken().then(() => protocolOnLoad());
  }, [protocolOnLoad, fetchToken]);

  const handleError = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setLoading(false);
    setError(true);
  }, []);

  const retry = useCallback(() => {
    if (!iframeRef.current) return;
    setLoading(true);
    setError(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      setError(true);
    }, IFRAME_TIMEOUT_MS);
    iframeRef.current.src = url;
  }, [url]);

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border"
      style={{ height: containerHeight ? `${containerHeight}px` : "calc(100vh - 10rem)" }}
    >
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
            <div className="mt-2 flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span className="text-sm">{t("loadingApp")}</span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="size-8 text-destructive" />
            <p className="text-sm font-medium">{t("iframeError")}</p>
            <p className="text-xs text-muted-foreground">{t("iframeErrorHint")}</p>
            <Button size="sm" variant="outline" onClick={retry}>
              <RefreshCw className="size-3.5" />
              {t("retry")}
            </Button>
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={url}
        title={title}
        className="size-full border-0"
        allow="clipboard-write; camera; microphone"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
}
