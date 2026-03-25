'use client';

import { CalendarDays, PanelLeft } from 'lucide-react';
import { usePathname } from 'next/navigation';

import { useSidebar } from '@/components/layout/sidebar-context';

const pageTitles: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'Painel executivo',
    description: 'Resumo da carteira: valores, economia e riscos operacionais em um só lugar.',
  },
  '/projects': {
    title: 'Carteira de contratos',
    description: 'Filtre, abra o detalhe e acompanhe compras, orçamento e reposições por projeto.',
  },
  '/suppliers': {
    title: 'Fornecedores',
    description: 'Cadastro usado ao registrar compras — mantenha dados consistentes para auditoria.',
  },
};

function derivePageCopy(pathname: string) {
  if (pathname.startsWith('/projects/') && pathname.includes('/documents')) {
    return { title: 'Documentos do Projeto', description: 'Anexos, processamento e revisão dos dados extraídos.' };
  }

  if (pathname.startsWith('/projects/') && pathname.includes('/roles')) {
    return { title: 'Cargos do Projeto', description: 'Postos, jornadas e quantitativos planejados.' };
  }

  if (pathname.startsWith('/projects/') && pathname.includes('/budget-items')) {
    return { title: 'Itens Orçados', description: 'Rubricas, quantidades previstas e origem dos itens.' };
  }

  if (pathname.startsWith('/projects/') && pathname.includes('/purchase-control')) {
    return {
      title: 'Controle de compras',
      description: 'Fase 2: mesmas linhas do edital com colunas operacionais (fornecedor, GLPI, prazos, reposição).',
    };
  }

  if (pathname.startsWith('/projects/') && pathname.includes('/purchases')) {
    return { title: 'Compras Reais', description: 'Pedidos, fornecedores, itens e comparação com a rubrica.' };
  }

  if (pathname.startsWith('/projects/') && pathname.includes('/replenishments')) {
    return { title: 'Reposições', description: 'Regras recorrentes, próximos eventos e histórico.' };
  }

  if (pathname.startsWith('/projects/')) {
    return { title: 'Projeto', description: 'Visão geral do contrato e seus módulos operacionais.' };
  }

  return pageTitles[pathname] ?? pageTitles['/'];
}

export function AppHeader() {
  const pathname = usePathname();
  const copy = derivePageCopy(pathname);
  const { open: sidebarOpen, setOpen: setSidebarOpen } = useSidebar();

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <div className="flex items-start gap-3 sm:gap-4">
            <button
              type="button"
              className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl border border-border/90 bg-card text-foreground shadow-md transition hover:bg-muted"
              onClick={() => setSidebarOpen(true)}
              aria-expanded={sidebarOpen}
              aria-haspopup="dialog"
              aria-label="Abrir menu principal"
            >
              <PanelLeft className="size-5" aria-hidden />
            </button>
            <div className="min-w-0">
              <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{copy.title}</h1>
              <p className="mt-1.5 text-sm font-medium leading-relaxed text-muted-foreground">{copy.description}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-border/90 bg-card px-4 py-2.5 text-sm text-muted-foreground shadow-sm">
            <CalendarDays className="size-4 text-primary" aria-hidden />
            <span className="tabular-nums">
              {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date())}
            </span>
          </div>
        </div>
      </header>
    </>
  );
}
