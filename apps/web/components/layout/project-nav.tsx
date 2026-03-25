'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const tabs = [
  { href: '', label: 'Visão Geral' },
  { href: '/documents', label: 'Documentos' },
  { href: '/roles', label: 'Cargos' },
  { href: '/budget-items', label: 'Itens Orçados' },
  { href: '/purchase-control', label: 'Controle de compras' },
  { href: '/purchases', label: 'Compras' },
  { href: '/replenishments', label: 'Reposições' },
];

export function ProjectNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();

  return (
    <div className="-mx-1 border-t border-border/80 pt-6">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Módulos do contrato</p>
      <div className="scrollbar-none flex gap-1 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const href = `/projects/${projectId}${tab.href}`;
          const active = pathname === href;

          return (
            <Link
              key={href}
              className={cn(
                'shrink-0 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors duration-200 ease-out',
                active
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'text-muted-foreground hover:bg-muted/90 hover:text-foreground',
              )}
              href={href}
              aria-current={active ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
