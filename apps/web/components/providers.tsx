'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Toaster } from 'sonner';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            /** Dados locais mudam pouco; evita refetch a cada navegação e deixa a UI mais rápida. */
            staleTime: 3 * 60 * 1000,
            gcTime: 20 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
            retryDelay: (attempt) => Math.min(800 * 2 ** attempt, 4000),
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        richColors
        closeButton
        position="top-right"
        toastOptions={{
          duration: 4500,
          classNames: {
            toast:
              'group rounded-xl border border-border/80 bg-card shadow-lg backdrop-blur-sm !font-sans',
            title: 'font-semibold text-foreground',
            description: 'text-sm text-muted-foreground',
            success: 'border-emerald-200/80',
            error: 'border-red-200/80',
            warning: 'border-amber-200/80',
            info: 'border-sky-200/80',
          },
        }}
      />
    </QueryClientProvider>
  );
}
