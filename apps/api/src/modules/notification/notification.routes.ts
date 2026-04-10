import { Router } from 'express';

import { notificationController } from '../../controllers/notification.controller.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { validateRequest } from '../../middlewares/validate.js';
import { notificationIdParamsSchema } from './notification.schemas.js';

export const notificationRouter = Router();

notificationRouter.get(
  '/notifications',
  asyncHandler((request, response) => notificationController.list(request, response)),
);

notificationRouter.get(
  '/notifications/unread-count',
  asyncHandler((request, response) => notificationController.unreadCount(request, response)),
);

notificationRouter.patch(
  '/notifications/:id/read',
  validateRequest({ params: notificationIdParamsSchema }),
  asyncHandler((request, response) => notificationController.markRead(request, response)),
);

notificationRouter.post(
  '/notifications/read-all',
  asyncHandler((request, response) => notificationController.markAllRead(request, response)),
);
