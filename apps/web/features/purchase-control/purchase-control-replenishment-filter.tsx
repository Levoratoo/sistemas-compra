'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Filter } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ReplenishmentRowFilter = 'all' | 'yellow' | 'green';

const REP_QUERY = 'rep' as const;

/** Lê o filtro a partir da query da URL (`rep=yellow|green`). */
export function replenishmentFilterFromSearchParams(
  searchParams: Pick<URLSearchParams, 'get'> | null,
): ReplenishmentRowFilter {
  const v = searchParams?.get(REP_QUERY);
  if (v === 'yellow' || v === 'amarelo') return 'yellow';
  if (v === 'green' || v === 'verde') return 'green';
  return 'all';
}

function setReplenishmentFilterInUrl(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  searchParams: URLSearchParams,
  next: ReplenishmentRowFilter,
) {
  const p = new URLSearchParams(searchParams.toString());
  if (next === 'all') {
    p.delete(REP_QUERY);
  } else {
    p.set(REP_QUERY, next);
  }
  const q = p.toString();
  router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
}

function PurchaseReplenishmentFilterUi({
  value,
  onChange,
}: {
  value: ReplenishmentRowFilter;
  onChange: (v: ReplenishmentRowFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const label =
    value === 'yellow'
      ? 'Alerta (amarelo)'
      : value === 'green'
        ? 'Confirmado (verde)'
        : 'Filtrar por cor';

  return (
    <div ref={rootRef} className="relative">
      <Button
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          'h-9 gap-2 rounded-full border border-border/80 bg-background/95 px-3 shadow-sm transition-all hover:bg-muted/70 hover:shadow-md',
          value !== 'all' && 'border-primary/35 ring-1 ring-primary/20',
        )}
        onClick={() => setOpen((o) => !o)}
        size="sm"
        title="Filtrar linhas por status de reposição (cores da planilha)"
        type="button"
        variant="outline"
      >
        <Filter className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
        <span className="hidden text-[11px] font-semibold tracking-tight text-foreground sm:inline">{label}</span>
        {value !== 'all' && (
          <span
            className={cn(
              'size-2 shrink-0 rounded-full',
              value === 'yellow' ? 'bg-amber-500' : 'bg-emerald-600 dark:bg-emerald-400',
            )}
            aria-hidden
          />
        )}
      </Button>
      {open ? (
        <div
          className="absolute right-0 top-[calc(100%+8px)] z-[100] w-[min(calc(100vw-2rem),18rem)] overflow-hidden rounded-2xl border border-border/80 bg-card py-1.5 text-card-foreground shadow-soft ring-1 ring-black/5 dark:ring-white/10"
          role="menu"
        >
          <p className="px-3 pb-1.5 pt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Status de reposição
          </p>
          <button
            className={cn(
              'flex w-full items-start gap-3 px-3 py-2.5 text-left text-[11px] transition-colors hover:bg-muted/90',
              value === 'yellow' && 'bg-amber-500/10',
            )}
            onClick={() => {
              onChange('yellow');
              setOpen(false);
            }}
            role="menuitem"
            type="button"
          >
            <span
              className="mt-0.5 h-8 w-1 shrink-0 rounded-full bg-amber-400 shadow-sm ring-1 ring-amber-600/25 dark:bg-amber-500"
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="font-semibold text-foreground">Amarelo</span>
              <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                Alerta de reposição — janela de 30 dias antes da data até confirmar o ciclo.
              </span>
            </span>
          </button>
          <button
            className={cn(
              'flex w-full items-start gap-3 px-3 py-2.5 text-left text-[11px] transition-colors hover:bg-muted/90',
              value === 'green' && 'bg-emerald-500/10',
            )}
            onClick={() => {
              onChange('green');
              setOpen(false);
            }}
            role="menuitem"
            type="button"
          >
            <span
              className="mt-0.5 h-8 w-1 shrink-0 rounded-full bg-emerald-500 shadow-sm ring-1 ring-emerald-700/25 dark:bg-emerald-400"
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="font-semibold text-foreground">Verde</span>
              <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                Ciclo de reposição já confirmado nesta linha.
              </span>
            </span>
          </button>
          {value !== 'all' ? (
            <>
              <div className="mx-2 my-1 h-px bg-border" role="separator" />
              <button
                className="w-full px-3 py-2 text-center text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                onClick={() => {
                  onChange('all');
                  setOpen(false);
                }}
                role="menuitem"
                type="button"
              >
                Mostrar todos os itens
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Filtro no cabeçalho global: sincroniza com `?rep=yellow|green`. */
export function AppPurchaseControlReplenishmentFilter() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const value = replenishmentFilterFromSearchParams(searchParams);

  return (
    <PurchaseReplenishmentFilterUi
      onChange={(next) => {
        setReplenishmentFilterInUrl(router, pathname, new URLSearchParams(searchParams.toString()), next);
      }}
      value={value}
    />
  );
}
