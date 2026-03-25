import { mkdirSync } from 'node:fs';

import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

mkdirSync(env.UPLOADS_DIR_ABSOLUTE, { recursive: true });

const app = createApp();

const host = '0.0.0.0';
app.listen(env.PORT, host, () => {
  logger.info(`API listening on ${host}:${env.PORT}`);
});
