import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma.js';

type DatabaseProbeResult =
  | { ok: true; durationMs: number }
  | { ok: false; durationMs: number; error: unknown };

function timeoutError(timeoutMs: number) {
  return new Error(`Database probe timed out after ${timeoutMs}ms.`);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(timeoutError(timeoutMs)), timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function probeDatabase(timeoutMs = 1_500): Promise<DatabaseProbeResult> {
  const startedAt = Date.now();

  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, timeoutMs);
    return { ok: true, durationMs: Date.now() - startedAt };
  } catch (error) {
    return { ok: false, durationMs: Date.now() - startedAt, error };
  }
}

export function isDatabaseConnectionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P1001';
  }

  if (error instanceof Error) {
    return /can't reach database server|database probe timed out/i.test(error.message);
  }

  return false;
}

