import type { Request, Response } from 'express';

import { notificationService } from '../services/notification.service.js';

class NotificationController {
  async list(request: Request, response: Response) {
    const userId = request.auth?.userId;
    const role = request.auth?.role;
    if (!userId || !role) {
      response.status(401).json({ message: 'Não autenticado.' });
      return;
    }

    const rows = await notificationService.listForUser(userId, role);
    response.json(rows);
  }

  async unreadCount(request: Request, response: Response) {
    const userId = request.auth?.userId;
    const role = request.auth?.role;
    if (!userId || !role) {
      response.status(401).json({ message: 'Não autenticado.' });
      return;
    }

    const count = await notificationService.unreadCount(userId, role);
    response.json({ count });
  }

  async markRead(request: Request, response: Response) {
    const userId = request.auth?.userId;
    if (!userId) {
      response.status(401).json({ message: 'Não autenticado.' });
      return;
    }

    const result = await notificationService.markRead(userId, String(request.params.id));
    response.json(result);
  }

  async markAllRead(request: Request, response: Response) {
    const userId = request.auth?.userId;
    if (!userId) {
      response.status(401).json({ message: 'Não autenticado.' });
      return;
    }

    await notificationService.markAllRead(userId);
    response.status(204).send();
  }
}

export const notificationController = new NotificationController();
