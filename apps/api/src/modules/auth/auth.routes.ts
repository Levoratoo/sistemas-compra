import { Router } from 'express';

import { authController } from '../../controllers/auth.controller.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const authProtectedRouter = Router();

authProtectedRouter.get('/auth/me', asyncHandler((request, response) => authController.me(request, response)));
