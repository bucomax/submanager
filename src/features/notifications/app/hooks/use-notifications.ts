"use client";

import { useCallback, useMemo, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { notificationKeys } from "@/features/notifications/app/hooks/query-keys";
import {
  useNotificationStream,
  warnNotificationFailure,
} from "@/features/notifications/app/hooks/use-notification-stream";
import {
  getNotifications,
  getUnreadCount,
  markAllRead,
  markNotificationRead,
} from "@/features/notifications/app/services/notifications.service";
import type { NotificationDto } from "@/features/notifications/app/types";
import { alertUserOfNotification } from "@/features/notifications/app/utils/notification-alert";
import { toast } from "@/lib/toast";
import type { NotificationsListResponseData } from "@/types/api/notification-v1";

const PAGE_SIZE = 20;
const POLL_INTERVAL_MS = 30_000;

type NotificationPages = InfiniteData<NotificationsListResponseData, string | undefined>;

/** Aplica `update` a cada notificação em cache (as páginas já carregadas). */
function mapCachedItems(
  pages: NotificationPages | undefined,
  update: (items: NotificationDto[]) => NotificationDto[],
): NotificationPages | undefined {
  return pages && { ...pages, pages: pages.pages.map((page) => ({ ...page, data: update(page.data) })) };
}

export function useNotifications() {
  const t = useTranslations("notifications.bell");
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const prependToCache = useCallback(
    (notification: NotificationDto, dedupe: boolean) =>
      queryClient.setQueryData<NotificationPages>(notificationKeys.list, (pages) => {
        if (!pages || pages.pages.length === 0) return pages;
        const [first, ...rest] = pages.pages;
        if (dedupe && pages.pages.some((p) => p.data.some((n) => n.id === notification.id))) return pages;
        return { ...pages, pages: [{ ...first, data: [notification, ...first.data] }, ...rest] };
      }),
    [queryClient],
  );

  const { polling } = useNotificationStream({
    onUnreadCount: (count) => queryClient.setQueryData(notificationKeys.unreadCount, count),
    onNotification: (notification) => {
      queryClient.setQueryData<number>(notificationKeys.unreadCount, (prev) => (prev ?? 0) + 1);
      prependToCache(notification, false);
      alertUserOfNotification(notification);
    },
  });

  // Contagem: no modo SSE ela chega por eventos (setQueryData); no polling a query busca no intervalo.
  const unreadQuery = useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: async ({ signal }) => {
      const previous = queryClient.getQueryData<number>(notificationKeys.unreadCount);
      const count = await getUnreadCount({ signal });
      // Contagem subiu durante o polling (ignora a primeira carga): busca e avisa a mais nova.
      if (previous !== undefined && count > previous) {
        try {
          const result = await getNotifications({ limit: 1 }, { signal });
          const newest = result.data[0];
          if (newest && !newest.readAt) {
            prependToCache(newest, true);
            alertUserOfNotification(newest);
          }
        } catch (err) {
          warnNotificationFailure("fetch newest notification", err);
        }
      }
      return count;
    },
    enabled: polling,
    refetchInterval: polling ? POLL_INTERVAL_MS : false,
    staleTime: 0,
  });
  const unreadCount = unreadQuery.data ?? 0;

  // Lista: só carrega com o painel aberto; abrir sempre recomeça da primeira página.
  const listQuery = useInfiniteQuery({
    queryKey: notificationKeys.list,
    queryFn: ({ pageParam, signal }) => getNotifications({ limit: PAGE_SIZE, cursor: pageParam }, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isOpen,
    staleTime: 0,
  });
  const { fetchNextPage, hasNextPage, isFetching } = listQuery;
  const items = useMemo(() => listQuery.data?.pages.flatMap((page) => page.data) ?? [], [listQuery.data]);

  const open = useCallback(() => {
    queryClient.setQueryData<NotificationPages>(notificationKeys.list, (pages) =>
      pages && { pages: pages.pages.slice(0, 1), pageParams: pages.pageParams.slice(0, 1) },
    );
    setIsOpen(true);
  }, [queryClient]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetching) {
      void fetchNextPage().catch((err) => warnNotificationFailure("load notifications", err));
    }
  }, [hasNextPage, isFetching, fetchNextPage]);

  /** Estado real do servidor após falha de uma mutação otimista (a contagem é rebuscada mesmo fora do polling). */
  const { refetch: refetchUnread } = unreadQuery;
  const resync = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: notificationKeys.list });
    void refetchUnread();
  }, [queryClient, refetchUnread]);

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onMutate: (id) => {
      const readAt = new Date().toISOString();
      queryClient.setQueryData<NotificationPages>(notificationKeys.list, (pages) =>
        mapCachedItems(pages, (list) => list.map((n) => (n.id === id ? { ...n, readAt } : n))),
      );
      queryClient.setQueryData<number>(notificationKeys.unreadCount, (prev) => Math.max(0, (prev ?? 0) - 1));
    },
    onError: resync,
  });
  const { mutate: markReadMutate } = markReadMutation;
  const markRead = useCallback(async (id: string) => markReadMutate(id), [markReadMutate]);

  const markAllMutation = useMutation({
    mutationFn: markAllRead,
    onMutate: () => {
      const snapshot = {
        list: queryClient.getQueryData<NotificationPages>(notificationKeys.list),
        count: queryClient.getQueryData<number>(notificationKeys.unreadCount),
      };
      const readAt = new Date().toISOString();
      queryClient.setQueryData<NotificationPages>(notificationKeys.list, (pages) =>
        mapCachedItems(pages, (list) => list.map((n) => (n.readAt ? n : { ...n, readAt }))),
      );
      queryClient.setQueryData<number>(notificationKeys.unreadCount, 0);
      return snapshot;
    },
    onSuccess: () => toast.success(t("markAllReadSuccess")),
    onError: (_error, _vars, snapshot) => {
      queryClient.setQueryData(notificationKeys.list, snapshot?.list);
      queryClient.setQueryData(notificationKeys.unreadCount, snapshot?.count);
      resync();
      toast.error(t("markAllReadError"));
    },
  });
  const { mutate: markAllMutate } = markAllMutation;

  const canMarkAllRead = useMemo(
    () => unreadCount > 0 || items.some((n) => !n.readAt),
    [unreadCount, items],
  );

  const markAllAsRead = useCallback(async () => {
    if (!canMarkAllRead || markAllMutation.isPending) return;
    markAllMutate();
  }, [canMarkAllRead, markAllMutation.isPending, markAllMutate]);

  return {
    unreadCount,
    items,
    loading: isFetching,
    isOpen,
    hasMore: Boolean(hasNextPage),
    canMarkAllRead,
    markAllReadPending: markAllMutation.isPending,
    open,
    close,
    loadMore,
    markRead,
    markAllAsRead,
  };
}
