import { apiRequest } from '@/services/api-client';
import type { AppNotification } from '@/types/api';

export function listNotifications() {
  return apiRequest<AppNotification[]>('notifications');
}

export function getUnreadNotificationCount() {
  return apiRequest<{ count: number }>('notifications/unread-count');
}

export function markNotificationRead(id: string) {
  return apiRequest<AppNotification>(`notifications/${id}/read`, {
    method: 'PATCH',
  });
}

export function markAllNotificationsRead() {
  return apiRequest<null>('notifications/read-all', {
    method: 'POST',
  });
}
