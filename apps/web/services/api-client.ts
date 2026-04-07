import type { ApiErrorPayload } from '@/types/api';
import { getStoredToken } from '@/lib/auth-storage';

/**
 * Base da API (termina em `/api` na URL pública do Render).
 * Produção (ex.: Vercel): `NEXT_PUBLIC_API_URL` vem embutida no build — é a única fonte.
 * Desenvolvimento: sem env, usa mesma origem + `/api` (proxy do `next dev`) ou fallback local.
 */
export function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (raw) {
    return raw.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || '';
    const prefix = basePath.replace(/\/+$/, '');
    return `${window.location.origin}${prefix}/api`;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'NEXT_PUBLIC_API_URL em falta no build de produção (deve estar definida na Vercel).',
    );
  }
  return 'http://localhost:3000/api';
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getStoredToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Não envia `Authorization` (usar em `auth/login` para nunca mandar JWT antigo). */
  skipAuth?: boolean;
};

const NETWORK_HINT =
  'Não foi possível contactar a API (rede, CORS no Render ou serviço indisponível).';

function rethrowIfNetworkFailure(cause: unknown): never {
  if (cause instanceof ApiError) {
    throw cause;
  }
  const msg = cause instanceof Error ? cause.message : String(cause);
  if (
    msg === 'Failed to fetch' ||
    msg.includes('NetworkError') ||
    msg.includes('Failed to load') ||
    msg.includes('Load failed')
  ) {
    throw new ApiError(NETWORK_HINT, 0, cause);
  }
  throw cause;
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const base = getApiBaseUrl().replace(/\/$/, '');
  const cleanPath = path.replace(/^\//, '');
  const url = new URL(`${base}/${cleanPath}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') {
        continue;
      }

      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.skipAuth ? {} : authHeaders()),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });
  } catch (e) {
    rethrowIfNetworkFailure(e);
  }

  if (response.status === 204) {
    return null as T;
  }

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T | ApiErrorPayload) : null;

  if (!response.ok) {
    const errorPayload = payload as ApiErrorPayload | null;
    throw new ApiError(
      errorPayload?.message ?? 'Falha ao se comunicar com a API.',
      response.status,
      errorPayload?.details,
    );
  }

  return payload as T;
}

function parseFilenameFromContentDisposition(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  const starMatch = /filename\*=(?:UTF-8''|UTF8'')([^;\s]+)/i.exec(trimmed);
  if (starMatch?.[1]) {
    try {
      return decodeURIComponent(starMatch[1].replace(/^"+|"+$/g, ''));
    } catch {
      return starMatch[1];
    }
  }
  const quoted = /filename="([^"]+)"/i.exec(trimmed);
  if (quoted?.[1]) {
    return quoted[1];
  }
  const unquoted = /filename=([^;\s]+)/i.exec(trimmed);
  if (unquoted?.[1]) {
    return unquoted[1].replace(/^"+|"+$/g, '');
  }
  return undefined;
}

/** GET binário com `Authorization` (ex.: download de documento). */
export async function apiGetBlob(path: string): Promise<{ blob: Blob; filename?: string }> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path), {
      method: 'GET',
      headers: authHeaders(),
      cache: 'no-store',
    });
  } catch (e) {
    rethrowIfNetworkFailure(e);
  }

  if (!response.ok) {
    const text = await response.text();
    let message = 'Falha ao baixar o arquivo.';
    if (text) {
      try {
        const payload = JSON.parse(text) as ApiErrorPayload;
        if (payload?.message) {
          message = payload.message;
        }
      } catch {
        /* resposta não JSON */
      }
    }
    throw new ApiError(message, response.status, undefined);
  }

  const filename = parseFilenameFromContentDisposition(response.headers.get('Content-Disposition'));
  const blob = await response.blob();
  return { blob, filename };
}

export async function apiUploadJson<T>(path: string, formData: FormData, method: 'POST' | 'PUT' = 'POST') {
  let response: Response;
  try {
    response = await fetch(buildUrl(path), {
      method,
      headers: authHeaders(),
      body: formData,
      cache: 'no-store',
    });
  } catch (e) {
    rethrowIfNetworkFailure(e);
  }

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T | ApiErrorPayload) : null;

  if (!response.ok) {
    const errorPayload = payload as ApiErrorPayload | null;
    throw new ApiError(
      errorPayload?.message ?? 'Falha ao se comunicar com a API.',
      response.status,
      errorPayload?.details,
    );
  }

  return payload as T;
}
