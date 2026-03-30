import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { z } from 'zod';

/** No Render, `PORT=` vazio no painel pode impedir a injeção automática; chave vazia não é porta válida. */
if (process.env.PORT === '') {
  delete process.env.PORT;
}
if (process.env.HTTP_PORT === '') {
  delete process.env.HTTP_PORT;
}

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const appRoot = path.resolve(currentDir, '../..');

// Em produção (Render, etc.) as variáveis vêm só do ambiente do host — não carregar `.env`
// do disco evita `PORT=` vazio ou valores locais a confundirem a porta efetiva.
if (process.env.NODE_ENV !== 'production') {
  config({ path: path.resolve(appRoot, '.env') });
}

/**
 * `z.coerce.number()` em `PORT` vazio vira `0` → Express escuta em `:0` e o Render falha o health check.
 * Ignora string vazia / não numérico / ≤0 / fora do intervalo; default 3000 só fora de produção.
 */
const portFromEnv = z.preprocess((val: unknown): number | undefined => {
  if (val === undefined || val === null) {
    return undefined;
  }
  const s = String(val).trim();
  if (s === '') {
    return undefined;
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n < 1 || n > 65535) {
    return undefined;
  }
  return Math.trunc(n);
}, z.number().int().min(1).max(65535).optional());

const envSchema = z.object({
  PORT: portFromEnv,
  CORS_ORIGIN: z.string().default('http://localhost:3016,http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  UPLOADS_DIR: z.string().default('./uploads'),
  /** Mínimo 32 caracteres em produção; em dev pode ficar vazio e usa fallback no código. */
  JWT_SECRET: z.string().optional(),
  JWT_EXPIRES_IN: z.string().default('7d'),
  /** EmailJS: envio de e-mail ao criar solicitação de item faltante (ver .env.example). */
  EMAILJS_ENABLED: z.string().optional(),
  EMAILJS_SERVICE_ID: z.string().optional(),
  EMAILJS_TEMPLATE_ID: z.string().optional(),
  /** Public Key (User ID) no painel EmailJS. */
  EMAILJS_PUBLIC_KEY: z.string().optional(),
  /** Private Key — recomendada para envio pelo servidor (API REST). */
  EMAILJS_PRIVATE_KEY: z.string().optional(),
  /** E-mail do dono da empresa que recebe o pedido de aprovação. */
  OWNER_APPROVAL_EMAIL: z.string().optional(),
  /** URL pública do front (link no e-mail). Ex.: https://app.seudominio.com */
  PUBLIC_APP_URL: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables', parsedEnv.error.flatten().fieldErrors);
  throw new Error('Environment validation failed');
}

function parsePortRaw(raw: unknown): number | undefined {
  const r = portFromEnv.safeParse(raw);
  if (!r.success || r.data === undefined) {
    return undefined;
  }
  return r.data;
}

function resolvePort(parsed: z.infer<typeof envSchema>): number {
  if (parsed.PORT !== undefined && parsed.PORT !== null) {
    return parsed.PORT;
  }
  const httpPort = parsePortRaw(process.env.HTTP_PORT);
  if (httpPort !== undefined) {
    return httpPort;
  }
  if (process.env.NODE_ENV === 'production') {
    // Último recurso no Render: em alguns deploys PORT não chega ao processo Node; a doc usa 10000 como exemplo.
    // Com Web Service, definir PORT=10000 no painel é preferível — isto evita crash se a injeção falhar.
    if (process.env.RENDER === 'true' || Boolean(process.env.RENDER_SERVICE_NAME)) {
      console.warn(
        '[env] PORT ausente ou inválido; a escutar em 10000. No Render: Environment → PORT=10000 ou remova PORT vazio.',
      );
      return 10000;
    }
    throw new Error(
      'PORT is missing or invalid (empty, zero or out of range). In production set PORT to 1–65535. On Render, use a Web Service (PORT is injected automatically); remove PORT from Environment if set to empty. You can set HTTP_PORT as an alternative.',
    );
  }
  return 3000;
}

function resolveJwtSecret(raw: string | undefined): string {
  const trimmed = raw?.trim();
  if (trimmed && trimmed.length >= 32) {
    return trimmed;
  }
  if (process.env.NODE_ENV !== 'production') {
    return 'dev-only-jwt-secret-min-32-chars-sitecompras';
  }
  throw new Error(
    'JWT_SECRET é obrigatório em produção (mínimo 32 caracteres). No Render: Web Service → Environment → Add Environment Variable → JWT_SECRET (ex.: saída de `openssl rand -base64 32`).',
  );
}

const data = parsedEnv.data;

export const env = {
  ...data,
  PORT: resolvePort(data),
  APP_ROOT: appRoot,
  UPLOADS_DIR_ABSOLUTE: path.resolve(appRoot, data.UPLOADS_DIR),
  JWT_SECRET: resolveJwtSecret(data.JWT_SECRET),
  JWT_EXPIRES_IN: data.JWT_EXPIRES_IN,
};

/** EmailJS pronto para envio (o destinatário do aprovador resolve-se em `emailjs.service`). */
export function isEmailJsConfigured(): boolean {
  return (
    data.EMAILJS_ENABLED === 'true' &&
    Boolean(data.EMAILJS_SERVICE_ID?.trim()) &&
    Boolean(data.EMAILJS_TEMPLATE_ID?.trim()) &&
    Boolean(data.EMAILJS_PUBLIC_KEY?.trim())
  );
}

export function getPublicAppUrl(): string {
  const raw = data.PUBLIC_APP_URL?.trim();
  if (raw) {
    return raw.replace(/\/+$/, '');
  }
  return 'http://localhost:3016';
}
