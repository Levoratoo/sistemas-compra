import type { CorsOptions } from 'cors';

import { env } from './env.js';

/**
 * CORS: lista em `CORS_ORIGIN` (Render) + qualquer subdomínio `*.vercel.app`.
 * Sem isto, pré-visualizações e URLs de branch na Vercel têm origem diferente de
 * `https://projeto.vercel.app` e o browser bloqueia o `fetch` (“Failed to fetch”).
 */
export function createCorsOptions(): CorsOptions {
  const allowList = env.CORS_ORIGIN.split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  return {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      const normalized = origin.replace(/\/+$/, '');
      if (allowList.includes(normalized)) {
        callback(null, true);
        return;
      }
      try {
        const { hostname } = new URL(origin);
        if (hostname.endsWith('.vercel.app')) {
          callback(null, true);
          return;
        }
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
          callback(null, true);
          return;
        }
      } catch {
        callback(null, false);
        return;
      }
      callback(null, false);
    },
    credentials: false,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}
