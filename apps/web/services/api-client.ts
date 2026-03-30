import type { ApiErrorPayload } from '@/types/api';
import { getStoredToken } from '@/lib/auth-storage';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

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
};

const NETWORK_HINT =
  'Não foi possível contactar a API. Se o site está na internet: defina NEXT_PUBLIC_API_URL no build (URL pública https da API), inclua a origem do site em CORS_ORIGIN na API e confira se o serviço da API está no ar.';

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
  const base = API_BASE_URL.replace(/\/$/, '');
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
        ...authHeaders(),
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

export async function apiUploadJson<T>(path: string, formData: FormData) {
  let response: Response;
  try {
    response = await fetch(buildUrl(path), {
      method: 'POST',
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
