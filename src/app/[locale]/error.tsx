"use client";

import * as Sentry from "@sentry/nextjs";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { useLastErrorStore } from "@/shared/stores/use-last-error-store";

/**
 * Boundary das rotas com locale. Registra o evento no store para o widget de
 * feedback já abrir com o vínculo pronto — é aqui que o usuário está no momento
 * em que ele de fato quer reportar.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("feedback.errorBoundary");
  const setLastError = useLastErrorStore((s) => s.setLastError);
  const [eventId, setEventId] = useState<string | null>(null);

  useEffect(() => {
    const id = Sentry.captureException(error);
    // Adia o setState pra um microtask: evita re-render em cascata síncrono
    // dentro do próprio effect (react-hooks/set-state-in-effect).
    queueMicrotask(() => {
      setEventId(id ?? null);
      setLastError({
        sentryEventId: id ?? null,
        requestId: null,
        route: window.location.pathname,
        capturedAt: Date.now(),
      });
    });
  }, [error, setLastError]);

  return (
    <div className="flex min-h-[60svh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground max-w-md text-sm">{t("description")}</p>
      {eventId ? (
        <p className="text-muted-foreground font-mono text-xs">
          {t("eventLabel")}: {eventId.slice(0, 8)}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button variant="outline" onClick={reset}>
          {t("retry")}
        </Button>
      </div>
    </div>
  );
}
