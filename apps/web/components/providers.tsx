'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useTheme } from 'next-themes';
import { Toaster } from 'sonner';

import { ThemeProvider } from '@/components/theme-provider';

function ThemeAwareToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
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
          success: 'border-emerald-500/30 dark:border-emerald-500/40',
          error: 'border-red-500/30 dark:border-red-500/40',
          warning: 'border-amber-500/30 dark:border-amber-500/40',
          info: 'border-sky-500/30 dark:border-sky-500/40',
        },
      }}
    />
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
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
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <ThemeAwareToaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
