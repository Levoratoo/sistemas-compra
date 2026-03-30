import { Router } from 'express';

import { userAdminController } from '../../controllers/user-admin.controller.js';
import { requireRole } from '../../middlewares/auth.js';
import { validateRequest } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  createUserSchema,
  updateUserSchema,
  userIdParamsSchema,
} from './user-admin.schemas.js';

export const userAdminRouter = Router();

userAdminRouter.use(requireRole('ADMIN'));

userAdminRouter.get('/users', asyncHandler((request, response) => userAdminController.list(request, response)));

userAdminRouter.post(
  '/users',
  validateRequest({ body: createUserSchema }),
  asyncHandler((request, response) => userAdminController.create(request, response)),
);

userAdminRouter.patch(
  '/users/:id',
  validateRequest({ params: userIdParamsSchema, body: updateUserSchema }),
  asyncHandler((request, response) => userAdminController.update(request, response)),
);
