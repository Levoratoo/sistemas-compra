'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/components/auth/auth-context';
import { canAccessProjectTab } from '@/lib/role-access';
import { cn } from '@/lib/utils';
import { prefetchProjectModuleQueries } from '@/lib/prefetch-project-module-queries';

const tabs = [
  { href: '', label: 'Visão Geral' },
  { href: '/documents', label: 'Documentos' },
  { href: '/purchase-control', label: 'Controle de compras' },
  { href: '/purchases', label: 'Checklist de compras' },
  { href: '/quotes', label: 'Orçamento' },
  { href: '/replenishments', label: 'Reposições' },
  { href: '/missing-items', label: 'Relatório de Itens Faltantes' },
];

export function ProjectNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const visibleTabs = tabs.filter((tab) => canAccessProjectTab(user?.role, tab.href));

  return (
    <div className="-mx-1 border-t border-border/80 pt-6">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Módulos do contrato</p>
      <div className="scrollbar-none flex gap-1 overflow-x-auto pb-1">
        {visibleTabs.map((tab) => {
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
              onFocus={() => void prefetchProjectModuleQueries(queryClient, projectId, tab.href)}
              onMouseEnter={() => void prefetchProjectModuleQueries(queryClient, projectId, tab.href)}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
