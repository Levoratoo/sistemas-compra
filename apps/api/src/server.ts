import { mkdirSync } from 'node:fs';

import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { ensureDemoUsers } from './services/demo-user.service.js';
import { probeDatabase } from './utils/database-health.js';

mkdirSync(env.UPLOADS_DIR_ABSOLUTE, { recursive: true });

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDatabaseBeforeStartup() {
  const attempts = process.env.NODE_ENV === 'production' ? 10 : 2;
  const delayMs = process.env.NODE_ENV === 'production' ? 2_500 : 500;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const probe = await probeDatabase(5_000);

    if (probe.ok) {
      if (attempt > 1) {
        logger.info(`Banco disponivel apos ${attempt} tentativas de startup.`);
      }
      return;
    }

    lastError = probe.error;
    logger.warn(`Banco indisponivel no startup (tentativa ${attempt}/${attempts}).`, probe.error);

    if (attempt < attempts) {
      await sleep(delayMs);
    }
  }

  throw lastError ?? new Error('Nao foi possivel conectar ao banco no startup da API.');
}

try {
  await waitForDatabaseBeforeStartup();
} catch (error) {
  logger.error('Falha critica: banco indisponivel antes de iniciar a API.', error);
  process.exit(1);
}

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
