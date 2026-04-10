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

/** `Router.use(requireRole)` aplicaria ADMIN a *todas* as rotas montadas depois no router pai — bloqueava GET /projects para não-admins. */
userAdminRouter.get('/users', requireRole('ADMIN'), asyncHandler((request, response) => userAdminController.list(request, response)));

userAdminRouter.post(
  '/users',
  requireRole('ADMIN'),
  validateRequest({ body: createUserSchema }),
  asyncHandler((request, response) => userAdminController.create(request, response)),
);

userAdminRouter.patch(
  '/users/:id',
  requireRole('ADMIN'),
  validateRequest({ params: userIdParamsSchema, body: updateUserSchema }),
  asyncHandler((request, response) => userAdminController.update(request, response)),
);
