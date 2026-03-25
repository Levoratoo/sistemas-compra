import path from 'node:path';

import { PrismaClient } from '@prisma/client';

import { env } from './env.js';

function resolveRuntimeDatabaseUrl(databaseUrl: string) {
  if (!databaseUrl.startsWith('file:')) {
    return databaseUrl;
  }

  const relativePath = databaseUrl.replace(/^file:\.?\/?/, '');
  const absolutePath = path.resolve(env.APP_ROOT, 'prisma', relativePath);
  return `file:${absolutePath.replace(/\\/g, '/')}`;
}

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: resolveRuntimeDatabaseUrl(env.DATABASE_URL),
    },
  },
});
