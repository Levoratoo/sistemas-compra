'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, CalendarPlus, FolderKanban, RefreshCcw, Wallet } from 'lucide-react';

import { EmptyState } from '@/components/common/empty-state';
import { ProjectStatusBadge } from '@/components/common/status-badge';
import { StatCard } from '@/components/common/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { useConsolidatedDashboardQuery } from '@/hooks/use-dashboard';

export function ConsolidatedDashboardContent() {
  const { data, isLoading, isError } = useConsolidatedDashboardQuery();

  if (isLoading) {
    return (
      <div className="page-sections">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="overflow-hidden">
              <CardContent className="p-6">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-[420px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        description="Confirme se o backend está em execução e se a rede permite acessar a API consolidada."
        title="Não foi possível carregar o painel"
      />
    );
  }

  return (
    <div className="page-sections">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          helper="Incluindo rascunhos e contratos ativos"
          icon={FolderKanban}
          title="Contratos na carteira"
          value={formatNumber(data.totalProjects)}
        />
        <StatCard
          helper={`${formatNumber(data.totalProjectsInImplementation)} em fase de implantação`}
          icon={ArrowRight}
          title="Em operação"
          value={formatNumber(data.totalActiveProjects)}
        />
        <StatCard
          helper={`${formatNumber(data.totalItemsWithoutBidReference)} item(ns) sem vínculo com rubrica`}
          icon={Wallet}
          title="Economia gerada"
          value={formatCurrency(data.totalSavings)}
        />
        <StatCard
          helper={`${formatNumber(data.totalOverdueReplenishments)} vencida(s) — exige ação`}
          icon={RefreshCcw}
          title="Reposições a vencer"
          value={formatNumber(data.totalUpcomingReplenishments)}
        />
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Desempenho por contrato</CardTitle>
            <CardDescription>Valores previstos, realizados e oportunidade de economia na carteira.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow variant="header">
                  <TableHead>Contrato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total previsto</TableHead>
                  <TableHead className="text-right">Total realizado</TableHead>
                  <TableHead className="text-right">Economia gerada</TableHead>
                  <TableHead className="text-right">Alertas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.projects.length === 0 ? (
                  <TableRow>
                    <TableCell className="p-0" colSpan={6}>
                      <div className="px-6 py-12 text-center">
                        <p className="text-sm font-medium text-muted-foreground">
                          Nenhum contrato cadastrado ainda. Cadastre um projeto para ver o resumo aqui.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.projects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="max-w-[220px]">
                        <Link
                          className="font-semibold text-primary underline-offset-4 transition-colors hover:underline"
                          href={`/projects/${project.id}`}
                        >
                          {project.name}
                        </Link>
                        <p className="mt-1 text-xs font-medium text-muted-foreground">{project.organizationName}</p>
                      </TableCell>
                      <TableCell>
                        <ProjectStatusBadge value={project.projectStatus} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatCurrency(project.totalPlanned)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatCurrency(project.totalRealized)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-emerald-700">
                        {formatCurrency(project.savings)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{formatNumber(project.alertsCount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarPlus className="size-4 text-primary" aria-hidden />
                Próximos eventos
              </CardTitle>
              <CardDescription>Reposições e itens recorrentes que precisam de atenção.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.upcomingEvents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center">
                  <p className="text-sm font-medium text-muted-foreground">Nenhuma reposição agendada no horizonte atual.</p>
                  <p className="mt-1 text-xs text-muted-foreground/90">Quando houver regras ativas, os prazos aparecerão aqui.</p>
                </div>
              ) : (
                data.upcomingEvents.map((event) => (
                  <div
                    key={`${event.projectId}-${event.budgetItemId}`}
                    className="rounded-xl border border-border/80 bg-muted/15 p-4 transition-colors hover:bg-muted/25"
                  >
                    <p className="font-semibold text-card-foreground">{event.budgetItemName}</p>
                    <p className="mt-0.5 text-sm font-medium text-muted-foreground">{event.projectName}</p>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary">{formatDate(event.plannedDate)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alertas da carteira</CardTitle>
              <CardDescription>Desvios de orçamento e reposições em situação crítica.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.alerts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center">
                  <p className="text-sm font-medium text-muted-foreground">Nenhum alerta no momento.</p>
                  <p className="mt-1 text-xs text-muted-foreground/90">O sistema avisa aqui quando houver risco operacional ou financeiro.</p>
                </div>
              ) : (
                data.alerts.slice(0, 6).map((alert, index) => (
                  <div
                    key={`${alert.projectId}-${index}`}
                    className="rounded-xl border border-amber-200/90 bg-amber-50/90 p-4 transition-shadow hover:shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-amber-100 p-2 text-amber-800">
                        <AlertTriangle className="size-4 shrink-0" aria-hidden />
                      </div>
                      <div>
                        <p className="font-semibold text-amber-950">{alert.title}</p>
                        <p className="mt-1 text-sm font-medium text-amber-900/85">{alert.message}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
