'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, CalendarDays, LogOut, PanelLeft } from 'lucide-react';

import { useAuth } from '@/components/auth/auth-context';
import { useSidebar } from '@/components/layout/sidebar-context';
import { ThemeToggle } from '@/components/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useNotificationMutations, useNotificationsQuery, useUnreadNotificationCountQuery } from '@/hooks/use-notifications';
import { getUserRoleLabel } from '@/lib/constants';
import { cn } from '@/lib/utils';

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

  if (pathname.startsWith('/projects/') && pathname.includes('/purchase-control')) {
    return {
      title: 'Controle de compras',
      description: 'Fase 2: mesmas linhas do edital com colunas operacionais (fornecedor, GLPI, prazos, reposição).',
    };
  }

  if (pathname.startsWith('/projects/') && pathname.includes('/purchases')) {
    return {
      title: 'Checklist de compras',
      description: 'Pedidos, fornecedores, itens e comparação com a rubrica.',
    };
  }

  if (
    pathname.startsWith('/projects/') &&
    pathname.includes('/replenishments/') &&
    /^\/projects\/[^/]+\/replenishments\/[^/]+$/.test(pathname)
  ) {
    return {
      title: 'Detalhe da reposição',
      description: 'Dados do controle de compras deste item para apoiar a reposição.',
    };
  }

  if (pathname.startsWith('/projects/') && pathname.includes('/replenishments')) {
    return { title: 'Reposições', description: 'Regras recorrentes, próximos eventos e histórico.' };
  }

  if (pathname.startsWith('/projects/') && pathname.includes('/missing-items')) {
    return {
      title: 'Relatório de itens faltantes',
      description: 'Solicitações adicionais do projeto, anexos e andamento da aprovação.',
    };
  }

  if (pathname.startsWith('/projects/')) {
    return { title: 'Projeto', description: 'Visão geral do contrato e seus módulos operacionais.' };
  }

  if (pathname.startsWith('/admin/users')) {
    return {
      title: 'Usuários',
      description: 'Gerencie contas, perfis (admin, usuário, aprovador, supervisora) e acessos ao sistema.',
    };
  }

  return pageTitles[pathname] ?? pageTitles['/'];
}

export function AppHeader() {
  const pathname = usePathname();
  const copy = derivePageCopy(pathname);
  const { user, logout } = useAuth();
  const { open: sidebarOpen, setOpen: setSidebarOpen } = useSidebar();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsQuery = useNotificationsQuery(Boolean(user));
  const unreadQuery = useUnreadNotificationCountQuery(Boolean(user));
  const { markRead, markAllRead } = useNotificationMutations();

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
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
            <ThemeToggle />
            {user ? (
              <>
                <Button
                  className="relative shrink-0 gap-1.5"
                  onClick={() => {
                    setNotificationsOpen(true);
                    void notificationsQuery.refetch();
                    void unreadQuery.refetch();
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                  aria-label="Notificações"
                >
                  <Bell className="size-4" aria-hidden />
                  {unreadQuery.data != null && unreadQuery.data.count > 0 ? (
                    <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {unreadQuery.data.count > 9 ? '9+' : unreadQuery.data.count}
                    </span>
                  ) : null}
                </Button>
                <Dialog onOpenChange={setNotificationsOpen} open={notificationsOpen}>
                  <DialogContent className="max-h-[min(90dvh,560px)] max-w-lg gap-0 overflow-hidden p-0">
                    <DialogHeader className="border-b border-border px-4 py-3">
                      <DialogTitle>Notificações</DialogTitle>
                    </DialogHeader>
                    <div className="max-h-[min(60dvh,420px)] overflow-y-auto px-2 py-2">
                      {notificationsQuery.isLoading ? (
                        <p className="px-2 py-6 text-center text-sm text-muted-foreground">A carregar…</p>
                      ) : notificationsQuery.isError ? (
                        <p className="px-2 py-6 text-center text-sm text-destructive">Não foi possível carregar.</p>
                      ) : !notificationsQuery.data?.length ? (
                        <p className="px-2 py-6 text-center text-sm text-muted-foreground">Sem notificações.</p>
                      ) : (
                        <ul className="space-y-1">
                          {notificationsQuery.data.map((n) => (
                            <li key={n.id}>
                              <Link
                                className={cn(
                                  'block rounded-lg border border-transparent px-3 py-2.5 text-left transition hover:bg-muted',
                                  !n.readAt && 'border-primary/25 bg-primary/5',
                                )}
                                href={`/projects/${n.projectId}/purchase-control`}
                                onClick={() => {
                                  if (!n.readAt) {
                                    void markRead.mutateAsync(n.id);
                                  }
                                  setNotificationsOpen(false);
                                }}
                              >
                                <span className="block text-sm font-medium text-foreground">{n.title}</span>
                                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{n.body}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <DialogFooter className="border-t border-border px-4 py-3 sm:justify-between">
                      <Button
                        disabled={markAllRead.isPending || !notificationsQuery.data?.some((n) => !n.readAt)}
                        onClick={() => void markAllRead.mutateAsync()}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        Marcar todas como lidas
                      </Button>
                      <Button onClick={() => setNotificationsOpen(false)} size="sm" type="button" variant="ghost">
                        Fechar
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/90 bg-card px-3 py-2 text-sm shadow-sm sm:gap-3 sm:px-4 sm:py-2.5">
                <div className="min-w-0 text-left">
                  <p className="truncate font-medium text-foreground">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
                <Badge className="shrink-0" variant="secondary">
                  {getUserRoleLabel(user.role)}
                </Badge>
                <Button
                  className="shrink-0 gap-1.5 text-muted-foreground"
                  onClick={() => logout()}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <LogOut className="size-4" aria-hidden />
                  Sair
                </Button>
              </div>
              </>
            ) : null}
            <div className="flex items-center gap-3 rounded-2xl border border-border/90 bg-card px-4 py-2.5 text-sm text-muted-foreground shadow-sm">
              <CalendarDays className="size-4 text-primary" aria-hidden />
              <span className="tabular-nums">
                {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date())}
              </span>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
