'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ChevronDown, Download, ExternalLink, FileText } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getMissingItemUrgencyLabel } from '@/lib/constants';
import { formatDate, formatFileSize } from '@/lib/format';
import { projectDocumentPublicFileUrl } from '@/lib/project-document-url';
import { cn } from '@/lib/utils';
import { useMissingItemApprovalDecisionMutation, usePendingMissingItemApprovalsQuery } from '@/hooks/use-missing-item-reports';
import type { PendingMissingItemApproval } from '@/types/api';

function urgencyBadgeVariant(level: PendingMissingItemApproval['urgencyLevel']) {
  if (level === 'HIGH') return 'danger' as const;
  if (level === 'MEDIUM') return 'warning' as const;
  return 'secondary' as const;
}

type PanelProps = {
  /** Se definido, mostra só pedidos pendentes deste contrato (vista no módulo do projeto). */
  scopeProjectId?: string;
};

function attachmentHref(storagePath: string) {
  return projectDocumentPublicFileUrl(storagePath);
}

export function PendingMissingItemsApprovalsPanel({ scopeProjectId }: PanelProps) {
  const { data: rawItems, isLoading, isError, refetch } = usePendingMissingItemApprovalsQuery();
  const decision = useMissingItemApprovalDecisionMutation();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const items = useMemo(() => {
    if (!rawItems?.length) return rawItems;
    if (!scopeProjectId) return rawItems;
    return rawItems.filter((i) => i.projectId === scopeProjectId);
  }, [rawItems, scopeProjectId]);

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
          {scopeProjectId ? (
            <>
              Pedidos deste contrato que ainda aguardam a sua decisão. Expanda cada cartão para ver quantidade, motivo e
              anexos.
            </>
          ) : (
            <>
              Solicitações registadas pelas supervisoras que aguardam aprovação. Expanda o cartão para ver todos os
              detalhes e anexos; pode também abrir o contrato para o relatório completo.
            </>
          )}
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
              description={
                scopeProjectId
                  ? 'Não há pedidos pendentes de aprovação para este contrato.'
                  : 'Quando uma supervisora registar um pedido, ele aparecerá aqui até ser aprovado ou rejeitado.'
              }
              title="Nenhuma solicitação pendente"
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map((row) => {
                const open = expandedIds.has(row.id);
                return (
                  <li
                    key={row.id}
                    className="rounded-xl border border-border/70 bg-card shadow-sm transition-colors hover:border-primary/20"
                  >
                    <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">{row.project.code}</span>
                          <span className="mx-1.5">·</span>
                          <span>{row.project.name}</span>
                        </p>
                        <p className="text-base font-semibold leading-snug text-foreground">{row.itemToAcquire}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>
                            Data da solicitação: {row.requestDate ? formatDate(row.requestDate) : '—'}
                          </span>
                          <span className="text-border">|</span>
                          <span>Responsável: {row.requesterName}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge className="text-[10px] font-normal" variant={urgencyBadgeVariant(row.urgencyLevel)}>
                            {getMissingItemUrgencyLabel(row.urgencyLevel)}
                          </Badge>
                          <Badge className="text-[10px] font-normal" variant="warning">
                            Aguardando aprovação
                          </Badge>
                        </div>
                        <button
                          aria-expanded={open}
                          className="flex items-center gap-1.5 text-left text-xs font-medium text-primary hover:underline"
                          type="button"
                          onClick={() => toggleExpanded(row.id)}
                        >
                          <ChevronDown
                            className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')}
                            aria-hidden
                          />
                          {open ? 'Ocultar detalhes da solicitação' : 'Ver detalhes da solicitação (quantidade, motivo, anexos)'}
                        </button>
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

                    {open ? (
                      <div className="border-t border-border/50 bg-muted/20 px-4 py-4 sm:px-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-8">
                          <div className="shrink-0 sm:w-32">
                            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                              Qtd. estimada
                            </p>
                            <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                              {row.estimatedQuantity}
                            </p>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                              Motivo / necessidade
                            </p>
                            <p className="mt-0.5 text-sm leading-relaxed text-foreground">{row.necessityReason}</p>
                          </div>
                        </div>
                        <div className="mt-4 border-t border-border/40 pt-3">
                          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                            Anexos
                          </p>
                          {row.attachments?.length ? (
                            <ul className="mt-2 space-y-2">
                              {row.attachments.map((att) => (
                                <li
                                  key={att.id}
                                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-background/80 px-3 py-2 text-sm"
                                >
                                  <FileText className="size-4 shrink-0 text-primary/90" aria-hidden />
                                  <a
                                    className="min-w-0 flex-1 truncate font-medium text-foreground underline-offset-2 hover:underline"
                                    href={attachmentHref(att.storagePath)}
                                    rel="noopener noreferrer"
                                    target="_blank"
                                  >
                                    {att.originalFileName}
                                  </a>
                                  <span className="shrink-0 text-xs text-muted-foreground">
                                    {formatFileSize(att.fileSizeBytes)}
                                  </span>
                                  <Button className="size-8 shrink-0" size="icon" type="button" variant="ghost" asChild>
                                    <a
                                      download={att.originalFileName}
                                      href={attachmentHref(att.storagePath)}
                                      rel="noopener noreferrer"
                                    >
                                      <Download className="size-4" aria-hidden />
                                    </a>
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1.5 text-xs text-muted-foreground">Nenhum anexo nesta solicitação.</p>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
