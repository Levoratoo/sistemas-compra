import { Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { logger } from '../config/logger.js';
import { AppError } from '../utils/app-error.js';

export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
) {
  logger.error('Unhandled error', error);

  if (error instanceof AppError) {
    return response.status(error.statusCode).json({
      message: error.message,
      details: error.details ?? null,
    });
  }

  if (error instanceof ZodError) {
    return response.status(422).json({
      message: 'Validation error',
      details: {
        issues: error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
          code: issue.code,
        })),
        flatten: error.flatten(),
      },
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P1001') {
      return response.status(503).json({
        message: 'Database unavailable',
        details: error.meta ?? null,
      });
    }

    if (error.code === 'P2002') {
      const meta = error.meta as { target?: string[] } | undefined;
      const target = meta?.target?.join(', ') ?? 'campos únicos';
      return response.status(409).json({
        message: `Conflito de unicidade (${target}). Se for órgão/processos/contratos repetidos entre projetos, ajuste os campos ou deixe processo/contrato vazio.`,
        details: error.meta ?? null,
      });
    }

    if (error.code === 'P2003') {
      return response.status(409).json({
        message: 'Relation constraint violation',
        details: error.meta ?? null,
      });
    }

    if (error.code === 'P2025') {
      return response.status(404).json({
        message: 'Record not found',
      });
    }
  }

  return response.status(500).json({
    message: 'Internal server error',
  });
}
