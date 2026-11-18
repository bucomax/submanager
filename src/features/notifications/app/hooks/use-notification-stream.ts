"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NotificationDto } from "@/features/notifications/app/types";

const SSE_RECONNECT_MS = 5_000;
const MAX_SSE_FAILURES = 3;

/** Falhas aqui não devem interromper a UI (sino é secundário), mas não podem sumir em silêncio. */
export function warnNotificationFailure(scope: string, err: unknown): void {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[notifications] ${scope} failed:`, err);
  }
}

type StreamHandlers = {
  onUnreadCount: (count: number) => void;
  onNotification: (notification: NotificationDto) => void;
};

/**
 * Conexão SSE de notificações com reconexão e fallback para polling.
 * `polling` vira `true` quando o servidor declara `mode: polling` ou após falhas seguidas de SSE;
 * quem consome decide como buscar (o hook de notificações liga o `refetchInterval` da query).
 */
export function useNotificationStream(handlers: StreamHandlers): { polling: boolean } {
  const [polling, setPolling] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sseFailuresRef = useRef(0);
  const usingPollingRef = useRef(false);
  /** Última versão de `connectSSE` (reconexão agendada a partir do próprio callback). */
  const connectSSERef = useRef<() => void>(() => {});
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const startPolling = useCallback(() => {
    if (usingPollingRef.current) return;
    usingPollingRef.current = true;
    setPolling(true);
  }, []);

  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) return;
    if (usingPollingRef.current) return;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
    const es = new EventSource(`${baseUrl}/api/v1/notifications/stream`, {
      withCredentials: true,
    });

    es.addEventListener("unread-count", (e) => {
      try {
        const data = JSON.parse(e.data) as { count: number };
        handlersRef.current.onUnreadCount(data.count);
        // Não zera `sseFailuresRef` aqui: o servidor envia este evento a cada (re)conexão,
        // mesmo quando o stream cai logo em seguida.
      } catch (err) {
        warnNotificationFailure("parse unread-count event", err);
      }
    });

    // Servidor sem tempo real (ex.: Vercel/modo inline): troca para polling imediatamente.
    es.addEventListener("mode", (e) => {
      try {
        const data = JSON.parse(e.data) as { mode?: string };
        if (data.mode !== "polling") return;
      } catch (err) {
        warnNotificationFailure("parse mode event", err);
        return;
      }
      es.close();
      eventSourceRef.current = null;
      startPolling();
    });

    es.addEventListener("notification", (e) => {
      try {
        const notification = JSON.parse(e.data) as NotificationDto;
        handlersRef.current.onNotification(notification);
        sseFailuresRef.current = 0;
      } catch (err) {
        warnNotificationFailure("parse notification event", err);
      }
    });

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      sseFailuresRef.current += 1;

      if (sseFailuresRef.current >= MAX_SSE_FAILURES) {
        startPolling();
        return;
      }

      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        connectSSERef.current();
      }, SSE_RECONNECT_MS);
    };

    eventSourceRef.current = es;
  }, [startPolling]);

  useEffect(() => {
    connectSSERef.current = connectSSE;
  }, [connectSSE]);

  useEffect(() => {
    connectSSE();
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      usingPollingRef.current = false;
    };
  }, [connectSSE]);

  return { polling };
}
