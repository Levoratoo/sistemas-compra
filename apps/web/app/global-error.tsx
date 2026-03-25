'use client';

import { useEffect } from 'react';

/**
 * Limite global de erro (App Router). Precisa ser Client Component e incluir html/body.
 * Evita falha do Turbopack ao resolver o global-error embutido do Next.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-neutral-950 px-6 py-10 font-sans text-neutral-100 antialiased">
        <div className="mx-auto max-w-lg space-y-4">
          <h1 className="text-xl font-semibold">Algo deu errado</h1>
          <p className="text-sm text-neutral-400">
            {error.message || 'Erro inesperado ao carregar a aplicação.'}
          </p>
          {error.digest ? (
            <p className="font-mono text-xs text-neutral-500">Digest: {error.digest}</p>
          ) : null}
          <button
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200"
            onClick={() => reset()}
            type="button"
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
