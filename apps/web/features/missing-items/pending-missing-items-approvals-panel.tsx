'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getMissingItemUrgencyLabel } from '@/lib/constants';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useMissingItemApprovalDecisionMutation, usePendingMissingItemApprovalsQuery } from '@/hooks/use-missing-item-reports';
import type { PendingMissingItemApproval } from '@/types/api';

function urgencyBadgeVariant(level: PendingMissingItemApproval['urgencyLevel']) {
  if (level === 'HIGH') return 'danger' as const;
  if (level === 'MEDIUM') return 'warning' as const;
  return 'secondary' as const;
}

export function PendingMissingItemsApprovalsPanel() {
  const { data: items, isLoading, isError, refetch } = usePendingMissingItemApprovalsQuery();
  const decision = useMissingItemApprovalDecisionMutation();

  async function setStatus(row: PendingMissingItemApproval, ownerApprovalStatus: 'APPROVED' | 'REJECTED') {
    try {
      await decision.mutateAsync({ id: row.id, ownerApprovalStatus });
      toast.success(ownerApprovalStatus === 'APPROVED' ? 'Solicitação aprovada.' : 'Solicitação rejeitada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar.');
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Aprovações — itens faltantes</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Solicitações registadas pelas supervisoras que aguardam aprovação. Aprove ou rejeite cada pedido; pode abrir o
          contrato para ver anexos e contexto.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Fila pendente</CardTitle>
          <CardDescription>
            {items?.length === 1 ? '1 solicitação aguardando.' : `${items?.length ?? '—'} solicitações aguardando.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ) : isError ? (
            <p className="text-sm text-destructive">
              Não foi possível carregar a fila.{' '}
              <button
                className="font-medium underline underline-offset-2"
                onClick={() => void refetch()}
                type="button"
              >
                Tentar de novo
              </button>
            </p>
          ) : !items?.length ? (
            <EmptyState
              description="Quando uma supervisora registar um pedido, ele aparecerá aqui até ser aprovado ou rejeitado."
              title="Nenhuma solicitação pendente"
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map((row) => (
                <li
                  key={row.id}
                  className="rounded-xl border border-border/70 bg-card p-4 shadow-sm transition-colors hover:border-primary/20"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{row.project.code}</span>
                        <span className="mx-1.5">·</span>
                        <span>{row.project.name}</span>
                      </p>
                      <p className="text-base font-semibold leading-snug text-foreground">{row.itemToAcquire}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>
                          {row.requestDate ? formatDate(row.requestDate) : '—'} · {row.requesterName}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge className="text-[10px] font-normal" variant={urgencyBadgeVariant(row.urgencyLevel)}>
                          {getMissingItemUrgencyLabel(row.urgencyLevel)}
                        </Badge>
                        <Badge className="text-[10px] font-normal" variant="warning">
                          Aguardando aprovação
                        </Badge>
                      </div>
                    </div>
                    <div
                      className={cn(
                        'flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end lg:flex-col lg:items-stretch',
                      )}
                    >
                      <Button asChild className="gap-2" size="sm" type="button" variant="outline">
                        <Link href={`/projects/${row.projectId}/missing-items`}>
                          <ExternalLink className="size-4" aria-hidden />
                          Abrir no contrato
                        </Link>
                      </Button>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          disabled={decision.isPending}
                          onClick={() => void setStatus(row, 'APPROVED')}
                          size="sm"
                          type="button"
                          variant="default"
                        >
                          Aprovar
                        </Button>
                        <Button
                          disabled={decision.isPending}
                          onClick={() => void setStatus(row, 'REJECTED')}
                          size="sm"
                          type="button"
                          variant="outline"
                          className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          Rejeitar
                        </Button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
