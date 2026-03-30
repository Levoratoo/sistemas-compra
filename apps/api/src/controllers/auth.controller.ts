import type { Request, Response } from 'express';

import type { LoginInput } from '../modules/auth/auth.schemas.js';
import { authService } from '../services/auth.service.js';

class AuthController {
  async login(request: Request, response: Response) {
    const body = request.body as LoginInput;
    const result = await authService.login(body.email, body.password);
    response.json(result);
  }

  async me(request: Request, response: Response) {
    const userId = request.auth?.userId;

    if (!userId) {
      response.status(401).json({ message: 'Não autenticado.' });
      return;
    }

    const user = await authService.me(userId);
    response.json(user);
  }
}

export const authController = new AuthController();
