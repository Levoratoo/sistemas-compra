'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ClipboardList, ExternalLink } from 'lucide-react';

import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getItemCategoryLabel } from '@/lib/constants';
import { effectiveNextReplenishmentIso } from '@/lib/budget-item-replenishment-date';
import { formatCurrency, formatDate } from '@/lib/format';
import { useBudgetItemsQuery } from '@/hooks/use-budget-items';
import { useProjectQuery } from '@/hooks/use-projects';

function caLabel(v: boolean | null) {
  if (v === true) return 'Sim';
  if (v === false) return 'Não';
  return '—';
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-border/50 py-3 last:border-b-0 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] sm:gap-6">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm leading-relaxed text-foreground">{children}</dd>
    </div>
  );
}

function displayOrDash(v: string | number | null | undefined, multiline = false) {
  if (v === null || v === undefined || v === '') return <span className="text-muted-foreground">—</span>;
  if (multiline) return <span className="whitespace-pre-wrap">{String(v)}</span>;
  return String(v);
}

export function ReplenishmentItemDetailPanel({
  projectId,
  budgetItemId,
}: {
  projectId: string;
  budgetItemId: string;
}) {
  const router = useRouter();
  const projectQuery = useProjectQuery(projectId);
  const itemsQuery = useBudgetItemsQuery(projectId);

  const item = itemsQuery.data?.find((i) => i.id === budgetItemId) ?? null;
  const project = projectQuery.data;

  const valorTotalFase2 =
    item && item.plannedQuantity != null && item.actualUnitValue != null
      ? item.plannedQuantity * item.actualUnitValue
      : item?.realTotalValue != null
        ? item.realTotalValue
        : null;

  const nextRep = item ? effectiveNextReplenishmentIso(item) : null;

  if (projectQuery.isLoading || itemsQuery.isLoading) {
    return (
      <div className="page-sections space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (projectQuery.isError || !project) {
    return (
      <EmptyState description="Recarregue ou volte à lista de projetos." title="Projeto não encontrado" />
    );
  }

  if (itemsQuery.isError) {
    return (
      <EmptyState description="Tente novamente em instantes." title="Erro ao carregar itens" />
    );
  }

  if (!item) {
    return (
      <EmptyState
        actionLabel="Voltar a Reposições"
        description="O item pode ter sido removido ou o link está incorreto."
        title="Item não encontrado"
        onAction={() => {
          router.push(`/projects/${projectId}/replenishments`);
        }}
      />
    );
  }

  return (
    <div className="page-sections space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button asChild className="gap-2" size="sm" variant="ghost">
            <Link href={`/projects/${projectId}/replenishments`}>
              <ArrowLeft className="size-4" aria-hidden />
              Reposições
            </Link>
          </Button>
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
              <ClipboardList className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {item.name}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Dados do <strong className="font-medium text-foreground">controle de compras</strong> para apoiar a
                reposição.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link className="inline-flex items-center gap-2" href={`/projects/${projectId}/purchase-control`}>
              Editar na planilha completa
              <ExternalLink className="size-4 opacity-80" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden border-primary/15 shadow-sm">
        <CardHeader className="border-b border-border/70 bg-muted/35 py-4">
          <CardTitle className="text-base">Fase 1 — Referência do edital</CardTitle>
          <CardDescription>Alinhado às colunas do controle de compras.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 px-4 sm:px-6">
          <dl>
            <DetailRow label="Órgão">{displayOrDash(project.organizationName)}</DetailRow>
            <DetailRow label="Classificação">{getItemCategoryLabel(item.itemCategory)}</DetailRow>
            <DetailRow label="Descrição">{displayOrDash(item.name, true)}</DetailRow>
            <DetailRow label="Especificação">{displayOrDash(item.specification ?? '', true)}</DetailRow>
            <DetailRow label="Tam.">{displayOrDash(item.sizeLabel ?? '', true)}</DetailRow>
            <DetailRow label="Req. CA">{caLabel(item.requiresCa)}</DetailRow>
          </dl>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-primary/15 shadow-sm">
        <CardHeader className="border-b border-border/70 bg-muted/35 py-4">
          <CardTitle className="text-base">Fase 2 — Operação</CardTitle>
          <CardDescription>Valores e prazos usados na compra e na reposição.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 px-4 sm:px-6">
          <dl>
            <DetailRow label="Função (ões)">{displayOrDash(item.roleReference)}</DetailRow>
            <DetailRow label="Nº Pessoas">{displayOrDash(item.peopleCount)}</DetailRow>
            <DetailRow label="Quantidade a ser comprada">{displayOrDash(item.plannedQuantity)}</DetailRow>
            <DetailRow label="Rubrica (R$)">
              {item.rubricMaxValue != null ? formatCurrency(item.rubricMaxValue) : '—'}
            </DetailRow>
            <DetailRow label="Requer CA">{caLabel(item.requiresCa)}</DetailRow>
            <DetailRow label="Status Compras">{displayOrDash(item.operationalPurchaseStatus)}</DetailRow>
            <DetailRow label="Data da assinatura do contrato">{formatDate(project.plannedSignatureDate)}</DetailRow>
            <DetailRow label="Prazo Edital (para entrega)">{displayOrDash(item.editalDeliveryDeadlineDays)}</DetailRow>
            <DetailRow label="Prazo reposição (Edital) em dias">{displayOrDash(item.replenishmentPeriodDaysEdital)}</DetailRow>
            <DetailRow label="Valor unitário">
              {item.actualUnitValue != null ? formatCurrency(item.actualUnitValue) : '—'}
            </DetailRow>
            <DetailRow label="Valor total">
              {valorTotalFase2 != null ? formatCurrency(valorTotalFase2) : '—'}
            </DetailRow>
            <DetailRow label="Fornecedor aprovado">{displayOrDash(item.approvedSupplierName)}</DetailRow>
            <DetailRow label="GLPI (número)">{displayOrDash(item.glpiTicketNumber)}</DetailRow>
            <DetailRow label="Data do envio para pagamento">{formatDate(item.opPaymentSentAt)}</DetailRow>
            <DetailRow label="Data prevista de entrega">{formatDate(item.opExpectedDeliveryAt)}</DetailRow>
            <DetailRow label="Data da entrega na unidade">{formatDate(item.opDeliveredAt)}</DetailRow>
            <DetailRow label="Status demais etapas">{displayOrDash(item.operationalStagesStatus)}</DetailRow>
            <DetailRow label="Data prevista de reposição">
              {nextRep ? (
                <span className="inline-flex rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 font-semibold text-primary">
                  {formatDate(nextRep)}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </DetailRow>
            <DetailRow label="Status de Reposição">{displayOrDash(item.replenishmentStateLabel)}</DetailRow>
            <DetailRow label="Competência">{displayOrDash(item.competenceLabel)}</DetailRow>
            <DetailRow label="Número do contrato">{displayOrDash(project.contractNumber)}</DetailRow>
            <DetailRow label="Taxa administrativa (%)">{displayOrDash(item.administrativeFeePercent)}</DetailRow>
            <DetailRow label="Observação">{displayOrDash(item.notes ?? '', true)}</DetailRow>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
