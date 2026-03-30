import type { NextConfig } from 'next';

/**
 * `NEXT_STATIC_EXPORT=1`: export estático (GitHub Pages, Render Static Site).
 * Rotas dinâmicas com IDs reais não têm HTML por URL — só navegação em cliente a partir de / ou /projects;
 * refresh ou abrir link direto nessas URLs devolve 404 no hosting. Para produção com deep links, use
 * Web Service + `next start` sem esta variável.
 */
const staticExport = process.env.NEXT_STATIC_EXPORT === '1';

/** Opcional: subpath (ex.: `nome-do-repo` no GitHub Pages). */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || undefined;

/**
 * Só em `next dev` local: encaminha `/api` e `/uploads` para o Express (API_BACKEND_URL).
 * Produção (ex.: Vercel + API no Render): não usa isto — o browser chama direto NEXT_PUBLIC_API_URL.
 */
const enableApiDevProxy =
  process.env.NODE_ENV === 'development' && process.env.NEXT_STATIC_EXPORT !== '1';

const nextConfig: NextConfig = {
  ...(staticExport && {
    output: 'export' as const,
    images: { unoptimized: true },
  }),
  ...(basePath ? { basePath } : {}),
  /** Evita chunk `vendor-chunks/zod.js` ausente no SSR (Webpack às vezes não gera o ficheiro relativo). */
  serverExternalPackages: ['zod'],
  reactStrictMode: true,
  /** Só em dev: esconde o “N” no canto (não acelera build; só remove o feedback visual). */
  devIndicators: false,
  /**
   * Dev em outro host (ex.: http://192.168.x.x:3016) — evita aviso/bloqueio futuro em /_next/*.
   * Padrões cobrem redes privadas comuns; ajuste se usar outro range.
   */
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*'],
  experimental: {
    /** Importa só os ícones usados (lucide), reduzindo JS inicial e rebuilds. */
    optimizePackageImports: ['lucide-react'],
  },
  ...(enableApiDevProxy && {
    async rewrites() {
      const backend = process.env.API_BACKEND_URL?.trim() || 'http://127.0.0.1:3000';
      const b = backend.replace(/\/+$/, '');
      return [
        { source: '/api/:path*', destination: `${b}/api/:path*` },
        { source: '/uploads/:path*', destination: `${b}/uploads/:path*` },
      ];
    },
  }),
};

export default nextConfig;
