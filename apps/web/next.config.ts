import type { NextConfig } from 'next';

/** Render Static Site / GitHub Pages: definir `NEXT_STATIC_EXPORT=1` no build. */
const staticExport = process.env.NEXT_STATIC_EXPORT === '1';

/** Opcional: subpath (ex.: `nome-do-repo` no GitHub Pages). */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || undefined;

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
};

export default nextConfig;
