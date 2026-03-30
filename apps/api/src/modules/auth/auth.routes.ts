import { Router } from 'express';

import { authController } from '../../controllers/auth.controller.js';
import { validateRequest } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { loginSchema } from './auth.schemas.js';

export const authPublicRouter = Router();

authPublicRouter.post(
  '/auth/login',
  validateRequest({ body: loginSchema }),
  asyncHandler((request, response) => authController.login(request, response)),
);

export const authProtectedRouter = Router();

authProtectedRouter.get('/auth/me', asyncHandler((request, response) => authController.me(request, response)));
