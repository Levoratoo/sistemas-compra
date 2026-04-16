import type { Response } from 'express';

export function sendHealthJson(response: Response): void {
  response.setHeader('X-Sitecompras-Health', '1');
  response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}

export function sendHealthHead(response: Response): void {
  response.setHeader('X-Sitecompras-Health', '1');
  response.status(200).end();
}
