import type { Response } from 'express';

import { probeDatabase } from './database-health.js';

export async function sendHealthJson(response: Response): Promise<void> {
  const probe = await probeDatabase();
  const statusCode = probe.ok ? 200 : 503;

  response.setHeader('X-Sitecompras-Health', '1');
  response.status(statusCode).json({
    status: probe.ok ? 'ok' : 'degraded',
    database: {
      status: probe.ok ? 'ok' : 'unreachable',
      latencyMs: probe.durationMs,
    },
    timestamp: new Date().toISOString(),
  });
}

export async function sendHealthHead(response: Response): Promise<void> {
  const probe = await probeDatabase();

  response.setHeader('X-Sitecompras-Health', '1');
  response.status(probe.ok ? 200 : 503).end();
}
