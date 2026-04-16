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
async function publicHealthMiddleware(request: Request, response: Response, next: NextFunction) {
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
    await sendHealthHead(response);
    return;
  }
  await sendHealthJson(response);
}

/**
 * Timeout de resposta por requisição.
 * Garante que o servidor sempre envia uma resposta (com headers CORS já setados)
 * antes de fechar a conexão — evita que o browser reporte "Failed to fetch" / erro de CORS.
 */
function responseTimeoutMiddleware(timeoutMs: number) {
  return (_request: Request, response: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      if (!response.headersSent) {
        response.status(503).json({
          message:
            'O servidor demorou demais para processar a requisição. Tente novamente com um arquivo menor ou aguarde o serviço reiniciar.',
        });
      }
    }, timeoutMs);

    response.on('finish', () => clearTimeout(timer));
    response.on('close', () => clearTimeout(timer));
    next();
  };
}

export function createApp() {
  const app = express();

  /**
   * CORS deve ser o PRIMEIRO middleware — garante que os headers de CORS estejam
   * presentes inclusive em respostas de erro, timeout e exceções não tratadas.
   */
  app.use(cors(createCorsOptions()));

  /**
   * Timeout global de 100 s (abaixo do timeout HTTP do servidor de 120 s).
   * Protege contra OCR pesado ou cold-start do banco que deixariam a conexão aberta.
   */
  app.use(responseTimeoutMiddleware(100_000));

  app.use(publicHealthMiddleware);
  app.use(morgan('dev'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/uploads', express.static(env.UPLOADS_DIR_ABSOLUTE));

  /** Evita 401 em `/` e `/favicon.ico` quando o browser ou monitor acede à raiz do serviço. */
  app.get('/', async (_request, response) => sendHealthJson(response));
  app.head('/', async (_request, response) => sendHealthHead(response));
  app.get('/favicon.ico', (_request, response) => response.status(204).end());
  app.head('/favicon.ico', (_request, response) => response.status(204).end());

  /** Rotas explícitas na app (a rota canónica em produção é `apiRouter.get('/health')`). */
  app.get('/health', async (_request, response) => sendHealthJson(response));
  app.get('/api/health', async (_request, response) => sendHealthJson(response));
  app.head('/health', async (_request, response) => sendHealthHead(response));
  app.head('/api/health', async (_request, response) => sendHealthHead(response));

  /**
   * Rotas REST sob `/api` (NEXT_PUBLIC_API_URL=…/api).
   */
  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
