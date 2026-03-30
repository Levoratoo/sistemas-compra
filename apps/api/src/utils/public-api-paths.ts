import type { Request } from 'express';

function stripTrailingSlashes(pathname: string): string {
  const t = pathname.replace(/\/+$/, '');
  return t === '' ? '/' : t;
}

/** Extrai pathname(s) possíveis do pedido (Express 5 + proxies podem variar `path` / `originalUrl`). */
function collectPathnameCandidates(request: Request): Set<string> {
  const out = new Set<string>();

  const add = (raw: string | undefined) => {
    if (raw === undefined || raw === '') {
      return;
    }
    let s = raw.split('?')[0] ?? raw;
    if (s.startsWith('http://') || s.startsWith('https://')) {
      try {
        s = new URL(s).pathname;
      } catch {
        return;
      }
    }
    out.add(stripTrailingSlashes(s || '/'));
  };

  add(request.path);
  add(request.originalUrl);
  add(request.url);

  const base = request.baseUrl ?? '';
  const p = request.path ?? '';
  if (base !== '' || p !== '') {
    const joined = `${base}${p === '/' && base !== '' ? '' : p}`;
    add(joined);
  }

  return out;
}

/**
 * Rotas GET/HEAD públicas sob o prefixo `/api` (Router montado).
 * No Express 5, `router.use(authenticate)` pode correr antes dos `router.get`; o Render
 * também pode expor `originalUrl` como URL absoluta.
 */
export function isPublicApiHealthRequest(request: Request): boolean {
  const m = request.method?.toUpperCase();
  if (m !== 'GET' && m !== 'HEAD') {
    return false;
  }

  for (const pathname of collectPathnameCandidates(request)) {
    if (pathname === '/api/health' || pathname === '/health' || pathname === '/api') {
      return true;
    }
  }

  return false;
}
