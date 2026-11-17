"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { NotificationDto } from "@/features/notifications/app/types";
import {
  getNotifications,
  getUnreadCount,
  markAllRead,
  markNotificationRead,
} from "@/features/notifications/app/services/notifications.service";
import { alertUserOfNotification } from "@/features/notifications/app/utils/notification-alert";
import { toast } from "@/lib/toast";

const PAGE_SIZE = 20;
const SSE_RECONNECT_MS = 5_000;
const POLL_INTERVAL_MS = 30_000;
const MAX_SSE_FAILURES = 3;

/** Falhas aqui não devem interromper a UI (sino é secundário), mas não podem sumir em silêncio. */
function warnNotificationFailure(scope: string, err: unknown): void {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[notifications] ${scope} failed:`, err);
  }
}

export function useNotifications() {
  const t = useTranslations("notifications.bell");
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [markAllReadPending, setMarkAllReadPending] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sseFailuresRef = useRef(0);
  const usingPollingRef = useRef(false);

  const prevUnreadRef = useRef(-1);
  /** Última versão de `connectSSE` (reconexão agendada a partir do próprio callback). */
  const connectSSERef = useRef<() => void>(() => {});

  const fetchUnreadCount = useCallback(async () => {
    try {
      const count = await getUnreadCount();
      const prev = prevUnreadRef.current;
      prevUnreadRef.current = count;
      setUnreadCount(count);

      // Se o count aumentou durante polling (ignora a primeira carga com prev === -1)
      if (prev >= 0 && count > prev) {
        try {
          const result = await getNotifications({ limit: 1 });
          const newest = result.data[0];
          if (newest && !newest.readAt) {
            setItems((current) => {
              if (current.some((n) => n.id === newest.id)) return current;
              return [newest, ...current];
            });
            alertUserOfNotification(newest);
          }
        } catch (err) {
          warnNotificationFailure("fetch newest notification", err);
        }
      }
    } catch (err) {
      warnNotificationFailure("fetch unread count", err);
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return;
    usingPollingRef.current = true;
    void fetchUnreadCount();
    pollTimerRef.current = setInterval(() => {
      void fetchUnreadCount();
    }, POLL_INTERVAL_MS);
  }, [fetchUnreadCount]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    usingPollingRef.current = false;
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
        setUnreadCount(data.count);
        prevUnreadRef.current = data.count;
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
        setUnreadCount((prev) => prev + 1);
        setItems((prev) => [notification, ...prev]);
        sseFailuresRef.current = 0;
        alertUserOfNotification(notification);
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
      stopPolling();
    };
  }, [connectSSE, stopPolling]);

  const loadItems = useCallback(async (cursor?: string) => {
    setLoading(true);
    try {
      const result = await getNotifications({ limit: PAGE_SIZE, cursor });
      if (cursor) {
        setItems((prev) => [...prev, ...result.data]);
      } else {
        setItems(result.data);
      }
      setNextCursor(result.nextCursor);
    } catch (err) {
      warnNotificationFailure("load notifications", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
    void loadItems();
  }, [loadItems]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const loadMore = useCallback(() => {
    if (nextCursor && !loading) {
      void loadItems(nextCursor);
    }
  }, [nextCursor, loading, loadItems]);

  const markRead = useCallback(
    async (id: string) => {
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      try {
        await markNotificationRead(id);
      } catch {
        void loadItems();
        void fetchUnreadCount();
      }
    },
    [loadItems, fetchUnreadCount],
  );

  const canMarkAllRead = useMemo(
    () => unreadCount > 0 || items.some((n) => !n.readAt),
    [unreadCount, items],
  );

  const markAllAsRead = useCallback(async () => {
    const hasUnread = unreadCount > 0 || items.some((n) => !n.readAt);
    if (!hasUnread || markAllReadPending) return;

    const prevItems = items.map((n) => ({ ...n }));
    const prevCount = unreadCount;
    setItems((prev) =>
      prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })),
    );
    setUnreadCount(0);
    setMarkAllReadPending(true);
    try {
      await markAllRead();
      toast.success(t("markAllReadSuccess"));
    } catch {
      setItems(prevItems);
      setUnreadCount(prevCount);
      void loadItems();
      void fetchUnreadCount();
      toast.error(t("markAllReadError"));
    } finally {
      setMarkAllReadPending(false);
    }
  }, [
    unreadCount,
    items,
    markAllReadPending,
    loadItems,
    fetchUnreadCount,
    t,
  ]);

  return {
    unreadCount,
    items,
    loading,
    isOpen,
    hasMore: nextCursor !== null,
    canMarkAllRead,
    markAllReadPending,
    open,
    close,
    loadMore,
    markRead,
    markAllAsRead,
  };
}
