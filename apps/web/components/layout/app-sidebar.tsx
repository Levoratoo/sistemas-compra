'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/layout/sidebar-context';
import { cn } from '@/lib/utils';
import { mainNav } from '@/lib/nav';

export function AppSidebar() {
  const pathname = usePathname();
  const { open, setOpen } = useSidebar();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-40 lg:z-40" role="presentation">
          <button
            aria-label="Fechar menu"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px] transition-opacity"
            type="button"
            onClick={() => setOpen(false)}
          />
          <aside
            className="absolute left-0 top-0 flex h-full w-[min(280px,92vw)] flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar px-5 py-8 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Menu principal"
          >
            <div className="mb-6 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-300/90">Navegação</span>
              <Button
                aria-label="Fechar menu"
                className="h-9 w-9 shrink-0 text-sidebar-foreground hover:bg-white/10"
                onClick={() => setOpen(false)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X className="size-5" />
              </Button>
            </div>
            <div className="space-y-10">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-300/95 ring-1 ring-white/10">
                  <Sparkles className="size-3.5 text-teal-400" aria-hidden />
                  Contratos
                </div>
                <div>
                  <h2 className="font-heading text-xl font-bold tracking-tight text-sidebar-foreground">
                    Módulo de compras
                  </h2>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-sidebar-muted">
                    Licitação, implantação e operação em um só lugar.
                  </p>
                </div>
              </div>

              <nav className="space-y-1" aria-label="Principal">
                {mainNav.map((item) => {
                  const active =
                    pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      className={cn(
                        'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-[background-color,color,box-shadow] duration-200 ease-out',
                        active
                          ? 'bg-gradient-to-r from-teal-500/25 to-white/[0.08] text-white shadow-inner ring-1 ring-white/15'
                          : 'text-sidebar-muted hover:bg-white/[0.07] hover:text-sidebar-foreground',
                      )}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => setOpen(false)}
                    >
                      <span
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-200',
                          active
                            ? 'bg-teal-400/30 text-teal-50'
                            : 'bg-white/5 text-sidebar-muted group-hover:bg-white/10 group-hover:text-sidebar-foreground',
                        )}
                      >
                        <Icon className="size-[18px]" aria-hidden />
                      </span>
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
