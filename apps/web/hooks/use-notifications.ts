'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/notifications-service';

export function useNotificationsQuery(enabled = true) {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => listNotifications(),
    enabled,
  });
}

export function useUnreadNotificationCountQuery(enabled = true) {
  return useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () => getUnreadNotificationCount(),
    refetchInterval: enabled ? 60_000 : false,
    enabled,
  });
}

export function useNotificationMutations() {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] }),
    ]);
  };

  return {
    markRead: useMutation({
      mutationFn: (id: string) => markNotificationRead(id),
      onSuccess: invalidate,
    }),
    markAllRead: useMutation({
      mutationFn: () => markAllNotificationsRead(),
      onSuccess: invalidate,
    }),
  };
}
