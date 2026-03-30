import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import type { UserRole } from '@prisma/client';

import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import { isPublicApiHealthRequest } from '../utils/public-api-paths.js';

type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
};

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

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.auth = {
      userId: decoded.sub,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch {
    next(new AppError('Token inválido ou expirado.', 401));
  }
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
