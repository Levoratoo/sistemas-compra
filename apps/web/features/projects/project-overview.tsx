'use client';

import { AlertTriangle, BriefcaseBusiness, PackageSearch, RefreshCcw, Wallet } from 'lucide-react';

import { AlertSeverityBadge, PurchaseStatusBadge, ReplenishmentStatusBadge } from '@/components/common/status-badge';
import { StatCard } from '@/components/common/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { useProjectDashboardQuery } from '@/hooks/use-dashboard';
import { useProjectQuery } from '@/hooks/use-projects';
import { usePurchasesQuery } from '@/hooks/use-purchases';
import { useReplenishmentsQuery } from '@/hooks/use-replenishments';

export function ProjectOverview({ projectId }: { projectId: string }) {
  const projectQuery = useProjectQuery(projectId);
  const dashboardQuery = useProjectDashboardQuery(projectId);
  const purchasesQuery = usePurchasesQuery(projectId);
  const replenishmentsQuery = useReplenishmentsQuery(projectId);

  /** Só bloqueia a tela no endpoint principal; compras/reposições preenchem em seguida (percepção mais rápida). */
  if (dashboardQuery.isPending && !dashboardQuery.data) {
    return (
      <div className="page-sections">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="p-6">
                <Skeleton className="h-28 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-[280px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm font-medium text-muted-foreground">
          Não foi possível carregar a visão geral do projeto.
        </CardContent>
      </Card>
    );
  }

  const dashboard = dashboardQuery.data;
  const project = projectQuery.data;
  const purchases = purchasesQuery.data ?? [];
  const replenishments = replenishmentsQuery.data ?? [];
  const purchasesPending = purchasesQuery.isPending;
  const replenishmentsPending = replenishmentsQuery.isPending;

  if (!project) {
    return null;
  }

  const totalRoles = project.roles.length;
  const totalHeadcount = project.roles.reduce((total, role) => total + role.plannedHeadcount, 0);
  const purchaseStatusCounts = purchases.reduce<Record<string, number>>((accumulator, purchase) => {
    accumulator[purchase.purchaseStatus] = (accumulator[purchase.purchaseStatus] ?? 0) + 1;
    return accumulator;
  }, {});
  const replenishmentStatusCounts = replenishments.reduce<Record<string, number>>((accumulator, rule) => {
    accumulator[rule.status] = (accumulator[rule.status] ?? 0) + 1;
    return accumulator;
  }, {});

  return (
    <div className="page-sections">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          helper={`${formatNumber(dashboard.itemsWithoutBidReference.length)} sem rubrica vinculada`}
          icon={Wallet}
          title="Total previsto"
          value={formatCurrency(dashboard.totalPlanned)}
        />
        <StatCard
          helper={
            purchasesPending ? 'Carregando pedidos…' : `${formatNumber(purchases.length)} pedido(s) registrado(s)`
          }
          icon={PackageSearch}
          title="Total realizado"
          value={formatCurrency(dashboard.totalRealized)}
        />
        <StatCard
          helper={`${formatNumber(totalRoles)} cargo(s) no plano`}
          icon={BriefcaseBusiness}
          title="Colaboradores planejados"
          value={formatNumber(totalHeadcount)}
        />
        <StatCard
          helper={
            replenishmentsPending
              ? 'Carregando regras…'
              : `${formatNumber(replenishments.length)} regra(s) de reposição`
          }
          icon={RefreshCcw}
          title="Economia gerada"
          value={formatCurrency(dashboard.savings)}
        />
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Compras por status</CardTitle>
            <CardDescription>Distribuição atual dos pedidos do projeto.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow variant="header">
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchasesPending && Object.keys(purchaseStatusCounts).length === 0 ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={2}>
                      Carregando compras…
                    </TableCell>
                  </TableRow>
                ) : (
                  Object.entries(purchaseStatusCounts).map(([status, total]) => (
                    <TableRow key={status}>
                      <TableCell>
                        <PurchaseStatusBadge value={status as never} />
                      </TableCell>
                      <TableCell>{formatNumber(total)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reposições por status</CardTitle>
            <CardDescription>Eventos recorrentes derivados do contrato.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {replenishmentsPending && Object.keys(replenishmentStatusCounts).length === 0 ? (
              <p className="text-sm text-muted-foreground">Carregando reposições…</p>
            ) : Object.entries(replenishmentStatusCounts).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma regra cadastrada.</p>
            ) : (
              Object.entries(replenishmentStatusCounts).map(([status, total]) => (
                <div
                  key={status}
                  className="flex items-center justify-between rounded-2xl border border-border bg-muted/40 px-4 py-3"
                >
                  <ReplenishmentStatusBadge value={status as never} />
                  <span className="font-semibold text-card-foreground">{formatNumber(total)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Próximos eventos</CardTitle>
            <CardDescription>Regras de reposição com data prevista calculada.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow variant="header">
                  <TableHead>Item</TableHead>
                  <TableHead>Data prevista</TableHead>
                  <TableHead>Alerta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.upcomingEvents.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={3}>
                      Nenhum evento previsto no momento.
                    </TableCell>
                  </TableRow>
                ) : (
                  dashboard.upcomingEvents.map((event) => (
                    <TableRow key={`${event.budgetItemId}-${event.plannedDate}`}>
                      <TableCell className="font-semibold">{event.budgetItemName}</TableCell>
                      <TableCell>{formatDate(event.plannedDate)}</TableCell>
                      <TableCell>{event.warningDays} dias</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertas derivados</CardTitle>
            <CardDescription>Itens acima da rubrica, sem rubrica ou com reposição crítica.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum alerta derivado no momento.</p>
            ) : (
              dashboard.alerts.map((alert, index) => (
                <div key={`${alert.projectId}-${index}`} className="rounded-2xl border border-border bg-muted/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="size-4 text-amber-700" />
                        <p className="font-semibold text-card-foreground">{alert.title}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">{alert.message}</p>
                    </div>
                    <AlertSeverityBadge severity={alert.severity} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
