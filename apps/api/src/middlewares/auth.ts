import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import type { UserRole } from '@prisma/client';

import { env } from '../config/env.js';
import { userRepository } from '../repositories/user.repository.js';
import { AppError } from '../utils/app-error.js';
import { isPublicApiHealthRequest } from '../utils/public-api-paths.js';
import { resolveAuthFromDbUser } from './auth-session.js';

/** Payload do JWT: só `sub` (userId) é fonte de verdade; email/role no token são legados e ignorados. */
type JwtPayload = {
  sub: string;
  email?: string;
  role?: UserRole;
  iat?: number;
  exp?: number;
};

export const OPERATIONAL_USER_ROLES: UserRole[] = ['ADMIN', 'USER', 'APPROVER'];
export const PROJECT_VIEWER_ROLES: UserRole[] = ['ADMIN', 'USER', 'APPROVER', 'SUPERVISOR'];

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  if (req.method === 'OPTIONS') {
    next();
    return;
  }

  if (isPublicApiHealthRequest(req)) {
    next();
    return;
  }

  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    next(new AppError('Token de acesso ausente.', 401));
    return;
  }

  const token = header.slice(7).trim();

  if (!token) {
    next(new AppError('Token de acesso ausente.', 401));
    return;
  }

  void authenticateWithDatabase(req, next, token).catch(next);
}

async function authenticateWithDatabase(req: Request, next: NextFunction, token: string) {
  let userId: string;

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    userId = decoded.sub;
    if (!userId) {
      next(new AppError('Token inválido.', 401));
      return;
    }
  } catch {
    next(new AppError('Token inválido ou expirado.', 401));
    return;
  }

  const user = await userRepository.findAuthContext(userId);
  const resolved = resolveAuthFromDbUser(user);

  if (!resolved.ok) {
    if (resolved.reason === 'missing') {
      next(new AppError('Sessão inválida: utilizador não encontrado.', 401));
      return;
    }
    next(new AppError('Utilizador inativo.', 401));
    return;
  }

  req.auth = resolved.auth;
  next();
}

export function requireRole(...allowed: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      next(new AppError('Não autenticado.', 401));
      return;
    }

    if (!allowed.includes(req.auth.role)) {
      next(new AppError('Sem permissão para este recurso.', 403));
      return;
    }

    next();
  };
}
