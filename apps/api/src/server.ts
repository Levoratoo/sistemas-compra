import { mkdirSync } from 'node:fs';

import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { ensureDemoUsers } from './services/demo-user.service.js';

mkdirSync(env.UPLOADS_DIR_ABSOLUTE, { recursive: true });

try {
  await ensureDemoUsers();
} catch (error) {
  logger.warn('Falha ao garantir os usuarios demo no startup da API.', error);
}

const app = createApp();

const host = '0.0.0.0';
const server = app.listen(env.PORT, host, () => {
  logger.info(`API listening on ${host}:${env.PORT}`);
});

/**
 * Timeout global do servidor HTTP.
 * No Render free tier, requisições pesadas (OCR de edital) podem demorar até 60 s.
 * Manter timeout acima da soma de OCR + DB para não fechar a conexão sem resposta
 * (o que o browser interpreta como "Failed to fetch" / erro de CORS).
 */
server.timeout = 120_000; // 120 s
server.keepAliveTimeout = 75_000; // maior que o timeout do load-balancer do Render (~65 s)
