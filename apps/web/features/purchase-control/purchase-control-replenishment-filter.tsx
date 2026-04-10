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

export type ReplenishmentFilterAppearance = 'full' | 'icon';

function PurchaseReplenishmentFilterUi({
  value,
  onChange,
  appearance = 'full',
}: {
  value: ReplenishmentRowFilter;
  onChange: (v: ReplenishmentRowFilter) => void;
  /** `icon` = só o símbolo, para a barra acima da planilha. */
  appearance?: ReplenishmentFilterAppearance;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const iconOnly = appearance === 'icon';

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
    <div ref={rootRef} className={cn('relative', iconOnly && 'flex justify-end')}>
      <Button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className={cn(
          'relative overflow-hidden transition-all',
          iconOnly
            ? cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-gradient-to-b from-background to-muted/30 p-0 shadow-md ring-1 ring-black/[0.06] hover:-translate-y-px hover:to-muted/45 hover:shadow-lg dark:from-card dark:to-muted/20 dark:ring-white/10',
                value !== 'all' && 'border-primary/40 ring-2 ring-primary/15',
              )
            : cn(
                'h-9 gap-2 rounded-full border border-border/80 bg-background/95 px-3 shadow-sm hover:bg-muted/70 hover:shadow-md',
                value !== 'all' && 'border-primary/35 ring-1 ring-primary/20',
              ),
        )}
        onClick={() => setOpen((o) => !o)}
        size="sm"
        title="Filtrar por linhas amarelas (alerta) ou verdes (ciclo confirmado)"
        type="button"
        variant="outline"
      >
        <Filter
          className={cn(
            'shrink-0 text-primary',
            iconOnly ? 'size-[1.15rem]' : 'size-4 text-muted-foreground',
          )}
          strokeWidth={iconOnly ? 2.25 : 2}
        />
        {!iconOnly ? (
          <span className="hidden text-[11px] font-semibold tracking-tight text-foreground sm:inline">{label}</span>
        ) : null}
        {value !== 'all' && (
          <span
            className={cn(
              'rounded-full ring-2 ring-background',
              iconOnly ? 'absolute right-1 top-1 size-2' : 'ml-0.5 size-2 shrink-0',
              value === 'yellow' ? 'bg-amber-500' : 'bg-emerald-600 dark:bg-emerald-400',
            )}
            aria-hidden
          />
        )}
      </Button>
      {open ? (
        <div
          className={cn(
            'absolute right-0 top-[calc(100%+10px)] w-[min(calc(100vw-2rem),17.5rem)] overflow-hidden rounded-2xl border border-border/70 bg-card/95 py-1.5 text-card-foreground shadow-[0_16px_48px_-12px_rgba(15,23,42,0.25)] backdrop-blur-md dark:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.45)]',
            'z-[200] ring-1 ring-black/5 dark:ring-white/10',
          )}
          role="menu"
        >
          <p className="px-3 pb-2 pt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Reposição na planilha
          </p>
          <button
            className={cn(
              'flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left text-[11px] transition-colors hover:bg-muted/90',
              value === 'yellow' && 'bg-amber-500/12',
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
              'flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left text-[11px] transition-colors hover:bg-muted/90',
              value === 'green' && 'bg-emerald-500/12',
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

/** Sincroniza com `?rep=yellow|green` na URL (partilhado entre instâncias). */
export function AppPurchaseControlReplenishmentFilter({
  appearance = 'full',
}: {
  appearance?: ReplenishmentFilterAppearance;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const value = replenishmentFilterFromSearchParams(searchParams);

  return (
    <PurchaseReplenishmentFilterUi
      appearance={appearance}
      onChange={(next) => {
        setReplenishmentFilterInUrl(router, pathname, new URLSearchParams(searchParams.toString()), next);
      }}
      value={value}
    />
  );
}
