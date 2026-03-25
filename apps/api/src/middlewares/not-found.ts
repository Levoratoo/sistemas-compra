import type { Request, Response } from 'express';

export function notFoundHandler(request: Request, response: Response) {
  response.status(404).json({
    message: `Route not found: ${request.method} ${request.originalUrl}`,
  });
}
