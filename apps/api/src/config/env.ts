import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { z } from 'zod';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const appRoot = path.resolve(currentDir, '../..');

config({ path: path.resolve(appRoot, '.env') });

/** Render (and some hosts) may expose PORT as ""; Number("") is 0 and breaks listen(). */
function parsePortInput(val: unknown): number | undefined {
  if (val === undefined || val === null) return undefined;
  const s = String(val).trim();
  if (s === '') return undefined;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

const envSchema = z.object({
  PORT: z.preprocess(parsePortInput, z.number().int().positive().default(3000)),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  UPLOADS_DIR: z.string().default('./uploads'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables', parsedEnv.error.flatten().fieldErrors);
  throw new Error('Environment validation failed');
}

export const env = {
  ...parsedEnv.data,
  APP_ROOT: appRoot,
  UPLOADS_DIR_ABSOLUTE: path.resolve(appRoot, parsedEnv.data.UPLOADS_DIR),
};
