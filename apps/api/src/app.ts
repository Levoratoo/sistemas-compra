import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';

import { createCorsOptions } from './config/cors-options.js';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/error-handler.js';
import { notFoundHandler } from './middlewares/not-found.js';
import { apiRouter } from './routes/index.js';
import { sendHealthHead, sendHealthJson } from './utils/health-response.js';

function healthPathOnly(pathname: string): string {
  if (!pathname) {
    return '/';
  }
  const noQuery = pathname.split('?')[0] ?? pathname;
  const trimmed = noQuery.replace(/\/+$/, '') || '/';
  return trimmed;
}

/**
 * Pathname fiável para health: `req.path` já vem normalizado; `originalUrl`/`url` por vezes
 * chegam como URL absoluta atrás de proxy e não coincidem com `/api/health`.
 */
function normalizedRequestPathname(request: Request): string {
  const fromExpressPath = typeof request.path === 'string' ? request.path : '';
  if (fromExpressPath) {
    return healthPathOnly(fromExpressPath);
  }
  const raw = request.originalUrl || request.url || '';
  const noQuery = raw.split('?')[0] ?? '';
  if (noQuery.startsWith('http://') || noQuery.startsWith('https://')) {
    try {
      return healthPathOnly(new URL(noQuery).pathname);
    } catch {
      return healthPathOnly(noQuery);
    }
  }
  return healthPathOnly(noQuery);
}

/**
 * Responde a `/health` e `/api/health` antes de qualquer Router (redundante com `apiRouter`).
 */
function publicHealthMiddleware(request: Request, response: Response, next: NextFunction) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    next();
    return;
  }
  const path = normalizedRequestPathname(request);
  if (path !== '/health' && path !== '/api/health') {
    next();
    return;
  }
  if (request.method === 'HEAD') {
    sendHealthHead(response);
    return;
  }
  sendHealthJson(response);
}

export function createApp() {
  const app = express();

  app.use(cors(createCorsOptions()));
  app.use(publicHealthMiddleware);
  app.use(morgan('dev'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/uploads', express.static(env.UPLOADS_DIR_ABSOLUTE));

  /** Evita 401 em `/` e `/favicon.ico` quando o browser ou monitor acede à raiz do serviço. */
  app.get('/', (_request, response) => sendHealthJson(response));
  app.head('/', (_request, response) => sendHealthHead(response));
  app.get('/favicon.ico', (_request, response) => response.status(204).end());
  app.head('/favicon.ico', (_request, response) => response.status(204).end());

  /** Rotas explícitas na app (a rota canónica em produção é `apiRouter.get('/health')`). */
  app.get('/health', (_request, response) => sendHealthJson(response));
  app.get('/api/health', (_request, response) => sendHealthJson(response));
  app.head('/health', (_request, response) => sendHealthHead(response));
  app.head('/api/health', (_request, response) => sendHealthHead(response));

  /**
   * Rotas REST sob `/api` (NEXT_PUBLIC_API_URL=…/api).
   */
  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
