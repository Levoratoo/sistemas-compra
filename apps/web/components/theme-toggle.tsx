'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={cn('size-10 shrink-0 rounded-xl border border-border/80 bg-card', className)}
        aria-hidden
      />
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn('shrink-0 rounded-xl border-border/90 bg-card shadow-sm', className)}
      aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      title={isDark ? 'Tema claro' : 'Tema escuro'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? (
        <Sun className="size-5 text-amber-400" aria-hidden />
      ) : (
        <Moon className="size-5 text-muted-foreground" aria-hidden />
      )}
    </Button>
  );
}
