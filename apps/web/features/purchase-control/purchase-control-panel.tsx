'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Dices } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getItemCategoryLabel } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useBudgetItemsMutations, useBudgetItemsQuery } from '@/hooks/use-budget-items';
import { useProjectQuery } from '@/hooks/use-projects';
import type { BudgetItem } from '@/types/api';
import type { BudgetItemPayload } from '@/services/budget-items-service';
import {
  AppPurchaseControlReplenishmentFilter,
  replenishmentFilterFromSearchParams,
} from '@/features/purchase-control/purchase-control-replenishment-filter';

const cell =
  'max-w-0 overflow-hidden border-b border-r border-border p-0 align-top dark:border-border';
/** Sem overflow-y hidden — `overflow-hidden` nas células cortava textarea (Especificação, etc.). */
const cellText =
  'max-w-0 align-top overflow-x-hidden overflow-y-visible border-b border-r border-border p-0 dark:border-border';
const inp =
  'box-border min-h-8 w-full min-w-0 border-0 bg-transparent px-1.5 py-1.5 text-[11px] leading-tight text-foreground outline-none focus:bg-muted focus:ring-1 focus:ring-inset focus:ring-primary/25';
const textareaInp =
  'min-h-[3rem] resize-y whitespace-pre-wrap [field-sizing:content] [overflow-wrap:anywhere]';
const th =
  'relative border-b border-r border-border bg-muted px-1.5 py-2 text-left text-[9px] font-semibold uppercase tracking-wide text-muted-foreground';

/**
 * Faixa “Fase 1” = texto do edital (sem duplicar prioridade/função/qtd/rubrica — isso fica na Fase 2).
 * Fase 2 = colunas operacionais (ordem fixa do modelo “Projetos - Controles”).
 */
const FASE1_COL_COUNT = 6;
const FASE2_COL_COUNT = 23;
const PURCHASE_CONTROL_COL_COUNT = FASE1_COL_COUNT + FASE2_COL_COUNT;

/** Default column widths (px); must match column order in thead / tbody. Tam. é mais larga para textos multilinha. */
const DEFAULT_COL_WIDTHS: number[] = [
  168, 84, 148, 120, 104, 72,
  132, 64, 72, 96, 100, 96, 72, 72, 88, 88, 120, 88, 88, 88, 88, 88, 88, 72, 88, 88, 88, 88, 140,
];

const FASE1_HEADERS: string[] = ['Órgão', 'Classif.', 'Descrição', 'Especificação', 'Tam.', 'Req. CA'];

/** Ordem exata solicitada para a Fase 2. */
const FASE2_HEADERS: string[] = [
  'Função (ões)',
  'Nº Pessoas',
  'Quantidade a ser comprada',
  'Rubrica (R$ valor na Licitação)',
  'Status Compras',
  'Data da assinatura do contrato',
  'Prazo Edital (para entrega)',
  'Prazo reposição (Edital) em dias',
  'Valor Unitário',
  'Valor total',
  'Fornecedor aprovado',
  'GLPI (número)',
  'Data do envio para pagamento',
  'Data prevista de entrega',
  'Data da entrega na unidade',
  'Status demais etapas',
  'Data Prevista de Reposição',
  'Conf. ciclo',
  'Status de Reposição',
  'Competência',
  'Número do contrato',
  'Taxa administrativa',
  'Observação',
];

const PURCHASE_CONTROL_HEADERS: string[] = [...FASE1_HEADERS, ...FASE2_HEADERS];

const COL_WIDTH_STORAGE_KEY = (projectId: string) => `purchase-control-col-widths:v6:${projectId}`;
const COL_MIN = 48;
const COL_MAX = 560;

function loadStoredWidths(projectId: string): number[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(COL_WIDTH_STORAGE_KEY(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== PURCHASE_CONTROL_COL_COUNT) return null;
    const nums = parsed.map((n) => Number(n));
    if (nums.some((n) => !Number.isFinite(n))) return null;
    return nums.map((n) => Math.min(COL_MAX, Math.max(COL_MIN, n)));
  } catch {
    return null;
  }
}

function persistWidths(projectId: string, widths: number[]) {
  try {
    localStorage.setItem(COL_WIDTH_STORAGE_KEY(projectId), JSON.stringify(widths));
  } catch {
    /* ignore quota */
  }
}

function numOrNull(v: string): number | null {
  const n = Number(v);
  return v === '' || Number.isNaN(n) ? null : n;
}

function intOrNull(v: string): number | null {
  const n = parseInt(v, 10);
  return v === '' || Number.isNaN(n) ? null : n;
}

/** Enter confirma (blur); Shift+Enter insere quebra de linha — alinhado ao uso em planilha. */
function sizeLabelKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
  if (e.key !== 'Enter' || e.shiftKey) return;
  if (e.nativeEvent.isComposing) return;
  e.preventDefault();
  e.currentTarget.blur();
}

function dateToIsoMidday(v: string): string | null {
  if (!v) return null;
  const d = new Date(`${v}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** +N meses de calendário a partir do dia do input (ex.: 15/03 → 15/09 com N=6). */
function addCalendarMonthsToDateInputIso(v: string, months: number): string | null {
  if (!v) return null;
  const d = new Date(`${v}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

/** Data prevista de reposição = entrega na unidade + 6 meses (ISO). */
function nextReplenishmentIsoFromDelivered(opDeliveredAtIso: string): string | null {
  const base = opDeliveredAtIso.slice(0, 10);
  if (!base) return null;
  return addCalendarMonthsToDateInputIso(base, 6);
}

function effectiveNextReplenishmentIso(item: BudgetItem): string | null {
  if (item.nextReplenishmentExpectedAt) return item.nextReplenishmentExpectedAt;
  if (item.opDeliveredAt) return nextReplenishmentIsoFromDelivered(item.opDeliveredAt);
  return null;
}

function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** A partir de 30 dias antes da data prevista (UTC), até confirmar — inclui após a data se ainda não confirmou. */
function isReplenishmentAttentionUi(effectiveIso: string): boolean {
  const eff = utcDayStart(new Date(effectiveIso));
  const today = utcDayStart(new Date());
  const windowStart = new Date(eff);
  windowStart.setUTCDate(windowStart.getUTCDate() - 30);
  return today.getTime() >= windowStart.getTime();
}

/** Mesma regra do alerta amarelo / “confirmar ciclo”: janela de 30 dias antes até confirmar. */
function isPendingReplenishmentRow(item: BudgetItem): boolean {
  if (item.contextOnly) return false;
  if (item.replenishmentCycleConfirmedAt) return false;
  const eff = effectiveNextReplenishmentIso(item);
  return eff != null && isReplenishmentAttentionUi(eff);
}

/** Linha com ciclo de reposição confirmado (destaque verde na tabela). */
function isGreenReplenishmentRow(item: BudgetItem): boolean {
  return Boolean(item.replenishmentCycleConfirmedAt);
}

const RANDOM_CATEGORIES: BudgetItem['itemCategory'][] = ['UNIFORM', 'EPI', 'EQUIPMENT', 'CONSUMABLE', 'OTHER'];

const RANDOM_ITEM_NAMES = [
  'Caixa de ferramenta',
  'Capacete de segurança classe B',
  'Carrinho de pedreiro reforçado',
  'Luvas nitrílica descartável',
  'Óculos de proteção incolor',
  'Máscara PFF2',
  'Cinto de segurança tipo paraquedista',
  'Botina com biqueira de aço',
  'Macacão de brim',
  'Protetor auricular tipo concha',
];

const PURCHASE_STATUS_OPTIONS = [
  'Iniciar orçamento',
  'Em orçamento',
  'Orçamento Concluído',
  'Compra Suspensa',
  'Em análise',
] as const;

const RANDOM_STATUS_COMPRAS = [...PURCHASE_STATUS_OPTIONS];

const PURCHASE_STATUS_NORMALIZATION_MAP = new Map<string, (typeof PURCHASE_STATUS_OPTIONS)[number]>([
  ['iniciar orcamento', 'Iniciar orçamento'],
  ['em orcamento', 'Em orçamento'],
  ['orcamento concluido', 'Orçamento Concluído'],
  ['compra suspensa', 'Compra Suspensa'],
  ['em analise', 'Em análise'],
  ['pendente', 'Iniciar orçamento'],
  ['em cotacao', 'Em orçamento'],
  ['aprovado', 'Orçamento Concluído'],
  ['aguardando nf', 'Em análise'],
  ['pago', 'Orçamento Concluído'],
]);

function normalizePurchaseStatusOption(value: string | null | undefined) {
  if (value == null) {
    return '';
  }

  const normalizedValue = value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();

  if (!normalizedValue) {
    return '';
  }

  return PURCHASE_STATUS_NORMALIZATION_MAP.get(normalizedValue) ?? '';
}

function randomInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** yyyy-mm-dd a partir de hoje + [min, max] dias. */
function randomYmdFromToday(minDays: number, maxDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + randomInt(minDays, maxDays));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function ymdAddDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** yyyy-mm-dd a partir de hoje + offset (dias podem ser negativos). */
function ymdTodayOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type RandomReposicaoScenario = 'nearDue' | 'overdue' | 'calm' | 'repostoLabel';

function scenarioFromRowIndex(rowIndex: number): RandomReposicaoScenario {
  const m = rowIndex % 4;
  if (m === 0) return 'nearDue';
  if (m === 1) return 'overdue';
  if (m === 2) return 'calm';
  return 'repostoLabel';
}

/**
 * Gera dados de teste para todas as colunas editáveis (Fase 1 + Fase 2).
 * Por linha alterna cenários de reposição: perto de vencer (janela amarela), em atraso, em dia (data longe) e rótulo “Reposto”
 * (alinhado a `purchaseControlReplenishmentRowStatus` / telas de reposição). `nextReplenishmentExpectedAt` explícito prevalece sobre entrega+6m.
 */
function buildRandomPurchaseControlPayload(rowIndex: number): Partial<BudgetItemPayload> {
  const cat = RANDOM_CATEGORIES[randomInt(0, RANDOM_CATEGORIES.length - 1)]!;
  const name = RANDOM_ITEM_NAMES[randomInt(0, RANDOM_ITEM_NAMES.length - 1)]!;
  const plannedQuantity = randomInt(1, 48);
  const rubricMaxValue = Math.round((Math.random() * 8000 + 300) * 100) / 100;
  const peopleCount = randomInt(1, 50);
  const actualUnitValue = Math.round((Math.random() * 400 + 5) * 100) / 100;
  const scenario = scenarioFromRowIndex(rowIndex);

  let payYmd: string;
  let expYmd: string;
  let delYmd: string;
  let nextRepIso: string | null;
  let replenishmentStateLabel: string;

  switch (scenario) {
    case 'nearDue': {
      const nextYmd = ymdTodayOffset(randomInt(6, 28));
      nextRepIso = dateToIsoMidday(nextYmd);
      delYmd = ymdTodayOffset(-randomInt(150, 190));
      expYmd = ymdAddDays(delYmd, -randomInt(4, 18));
      payYmd = ymdAddDays(expYmd, -randomInt(12, 40));
      replenishmentStateLabel = 'Acompanhar — prazo de reposição próximo';
      break;
    }
    case 'overdue': {
      const nextYmd = ymdTodayOffset(-randomInt(10, 55));
      nextRepIso = dateToIsoMidday(nextYmd);
      delYmd = ymdTodayOffset(-randomInt(220, 420));
      expYmd = ymdAddDays(delYmd, -randomInt(5, 25));
      payYmd = ymdAddDays(expYmd, -randomInt(15, 50));
      replenishmentStateLabel = 'Atraso — repor o quanto antes';
      break;
    }
    case 'calm': {
      const nextYmd = ymdTodayOffset(randomInt(140, 320));
      nextRepIso = dateToIsoMidday(nextYmd);
      delYmd = ymdTodayOffset(-randomInt(20, 90));
      expYmd = ymdAddDays(delYmd, -randomInt(3, 14));
      payYmd = ymdAddDays(expYmd, -randomInt(10, 35));
      replenishmentStateLabel = 'Em dia';
      break;
    }
    case 'repostoLabel': {
      const nextYmd = ymdTodayOffset(randomInt(45, 160));
      nextRepIso = dateToIsoMidday(nextYmd);
      delYmd = ymdTodayOffset(-randomInt(160, 240));
      expYmd = ymdAddDays(delYmd, -randomInt(4, 20));
      payYmd = ymdAddDays(expYmd, -randomInt(12, 45));
      replenishmentStateLabel = 'Reposto — teste automático (mesmos dados nas telas de reposição)';
      break;
    }
  }

  const payIso = dateToIsoMidday(payYmd);
  const expIso = dateToIsoMidday(expYmd);
  const delIso = dateToIsoMidday(delYmd);

  return {
    itemCategory: cat,
    name,
    specification: `Especificação teste — lote ${randomInt(100, 999)}; cenário ${scenario}; conforme edital.`,
    sizeLabel: ['PP', 'P', 'M', 'G', 'GG', 'XG'][randomInt(0, 5)] ?? 'Único',
    requiresCa: Math.random() < 0.4 ? true : Math.random() < 0.5 ? false : null,
    roleReference: `${randomInt(1, 12)}. ${['Materiais', 'Equipamentos', 'EPIs', 'Uniformes'][randomInt(0, 3)]} — referência ${randomInt(1, 99)}`,
    peopleCount,
    plannedQuantity,
    rubricMaxValue,
    operationalPurchaseStatus:
      RANDOM_STATUS_COMPRAS[randomInt(0, RANDOM_STATUS_COMPRAS.length - 1)] ?? 'Iniciar orçamento',
    editalDeliveryDeadlineDays: randomInt(15, 120),
    replenishmentPeriodDaysEdital: randomInt(30, 365),
    actualUnitValue,
    approvedSupplierName: `Fornecedor Teste ${randomInt(10, 99)} LTDA`,
    glpiTicketNumber: String(randomInt(100000, 999999)),
    opPaymentSentAt: payIso,
    opExpectedDeliveryAt: expIso,
    opDeliveredAt: delIso,
    nextReplenishmentExpectedAt: nextRepIso,
    operationalStagesStatus: `Etapa ${randomInt(1, 5)} / ${randomInt(5, 8)}`,
    replenishmentStateLabel,
    competenceLabel: `${String(randomInt(1, 12)).padStart(2, '0')}/2026`,
    administrativeFeePercent: Math.round(Math.random() * 120) / 10,
    notes: `Teste automático (${scenario}) em ${new Date().toLocaleString('pt-BR')} — datas alinhadas ao controle e às telas de reposição.`,
  };
}

function commitDeliveryAndReposicao(
  onPatch: (id: string, p: Partial<BudgetItemPayload>) => void,
  itemId: string,
  rawDate: string,
) {
  const delivered = dateToIsoMidday(rawDate);
  if (rawDate && delivered) {
    const nextRep = addCalendarMonthsToDateInputIso(rawDate, 6);
    void onPatch(itemId, {
      opDeliveredAt: delivered,
      nextReplenishmentExpectedAt: nextRep,
    });
  } else {
    void onPatch(itemId, { opDeliveredAt: null, nextReplenishmentExpectedAt: null });
  }
}

export function PurchaseControlPanel({ projectId }: { projectId: string }) {
  const searchParams = useSearchParams();
  const projectQuery = useProjectQuery(projectId);
  const itemsQuery = useBudgetItemsQuery(projectId);
  const { updateItem, confirmReplenishmentCycle, unconfirmReplenishmentCycle } =
    useBudgetItemsMutations(projectId);

  const [colWidths, setColWidths] = useState<number[]>(() => loadStoredWidths(projectId) ?? [...DEFAULT_COL_WIDTHS]);
  const colWidthsRef = useRef(colWidths);

  useEffect(() => {
    colWidthsRef.current = colWidths;
  }, [colWidths]);

  useEffect(() => {
    setColWidths(loadStoredWidths(projectId) ?? [...DEFAULT_COL_WIDTHS]);
  }, [projectId]);

  const startColumnResize = useCallback(
    (colIndex: number, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = colWidthsRef.current[colIndex] ?? DEFAULT_COL_WIDTHS[colIndex];

      const onMove = (ev: MouseEvent) => {
        const d = ev.clientX - startX;
        const next = Math.min(COL_MAX, Math.max(COL_MIN, startW + d));
        setColWidths((ws) => {
          const n = [...ws];
          n[colIndex] = next;
          return n;
        });
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        persistWidths(projectId, colWidthsRef.current);
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [projectId],
  );

  const [randomFillBusy, setRandomFillBusy] = useState(false);

  const replenishmentFilter = replenishmentFilterFromSearchParams(searchParams);
  const items = itemsQuery.data ?? [];
  const visibleItems = useMemo(() => {
    if (replenishmentFilter === 'all') return items;
    if (replenishmentFilter === 'yellow') return items.filter(isPendingReplenishmentRow);
    return items.filter(isGreenReplenishmentRow);
  }, [items, replenishmentFilter]);

  async function patch(id: string, payload: Partial<BudgetItemPayload>) {
    try {
      await updateItem.mutateAsync({ id, payload });
    } catch {
      toast.error('Não foi possível salvar a célula.');
    }
  }

  /** Preenche todas as colunas editáveis (Fase 1 + Fase 2) com dados aleatórios — só para testes. */
  async function fillRandomPurchaseControlData() {
    const rows = itemsQuery.data ?? [];
    const targets = rows.filter((r) => !(r.contextOnly ?? false));
    if (targets.length === 0) {
      toast.message('Nenhuma linha editável (itens só de contexto estão excluídos).');
      return;
    }
    setRandomFillBusy(true);
    try {
      const results = await Promise.allSettled(
        targets.map((row, index) =>
          updateItem.mutateAsync({
            id: row.id,
            payload: buildRandomPurchaseControlPayload(index),
          }),
        ),
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        toast.error(`${failed} linha(s) falharam ao salvar. Verifique a rede ou tente novamente.`);
      } else {
        toast.success(
          `${targets.length} linha(s) preenchidas com cenários de reposição (próximo do vencimento, em atraso, em dia e reposto).`,
        );
      }
    } catch {
      toast.error('Falha ao aplicar valores aleatórios.');
    } finally {
      setRandomFillBusy(false);
    }
  }

  if (projectQuery.isLoading || itemsQuery.isLoading) {
    return (
      <div className="page-sections space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (projectQuery.isError || !projectQuery.data) {
    return (
      <EmptyState description="Recarregue a página ou volte à lista de projetos." title="Projeto não encontrado" />
    );
  }

  const project = projectQuery.data;

  return (
    <div className="w-full min-w-0">
      {itemsQuery.isError ? (
        <EmptyState description="Tente novamente em instantes." title="Erro ao carregar itens" />
      ) : items.length === 0 ? (
        <EmptyState
          description="Aplique a extração do edital na revisão do documento ou cadastre itens em Itens orçados."
          title="Nenhum item neste projeto"
        />
      ) : (
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex h-10 min-h-10 shrink-0 items-center justify-end py-0">
            <Suspense
              fallback={
                <div
                  aria-hidden
                  className="h-10 w-10 shrink-0 rounded-2xl border border-border/60 bg-muted/30"
                />
              }
            >
              <AppPurchaseControlReplenishmentFilter appearance="icon" />
            </Suspense>
          </div>
          <Card className="min-w-0 overflow-hidden border-border/80 shadow-sm">
            <CardContent className="min-w-0 p-0">
              <div className="max-h-[min(78vh,920px)] w-full min-w-0 overflow-x-auto overflow-y-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
              <table
                className="w-max min-w-full border-collapse text-[11px] antialiased"
                style={{ tableLayout: 'fixed' }}
              >
                <colgroup>
                  {colWidths.map((w, i) => (
                    <col key={i} style={{ width: w }} />
                  ))}
                </colgroup>
                <thead className="sticky top-0 z-20 shadow-sm">
                  <tr className="bg-muted/90 backdrop-blur">
                    <th
                      className="border-b border-border px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-primary"
                      colSpan={FASE1_COL_COUNT}
                    >
                      <div className="flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        <span className="min-w-0 shrink">Fase 1 — Referência do edital</span>
                        <Button
                          className="h-auto min-h-7 max-w-[min(100%,16rem)] shrink-0 gap-1.5 whitespace-normal px-2 py-1 text-center text-[10px] font-semibold leading-tight normal-case"
                          disabled={randomFillBusy}
                          onClick={() => void fillRandomPurchaseControlData()}
                          size="sm"
                          title="Preenche todas as colunas editáveis (classificação, textos, tamanhos, números, datas, fornecedor, GLPI, taxa, observação, etc.) com dados aleatórios para testes."
                          type="button"
                          variant="secondary"
                        >
                          <Dices className="size-3.5 shrink-0" />
                          Gerar informações aleatórias
                        </Button>
                      </div>
                    </th>
                    <th
                      className="border-b border-border px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-primary"
                      colSpan={FASE2_COL_COUNT}
                    >
                      Fase 2 — Operação
                    </th>
                  </tr>
                  <tr>
                    {PURCHASE_CONTROL_HEADERS.map((label, i) => (
                      <th key={i} className={th} style={{ width: colWidths[i] }}>
                        <span className="block truncate pr-2" title={label}>
                          {label}
                        </span>
                        <div
                          className="absolute right-0 top-0 z-10 h-full w-2.5 cursor-col-resize touch-none select-none hover:bg-primary/30"
                          title="Arrastar para redimensionar a coluna"
                          onMouseDown={(e) => startColumnResize(i, e)}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.length === 0 && replenishmentFilter !== 'all' && items.length > 0 ? (
                    <tr>
                      <td
                        className="border-b border-border bg-muted/30 px-4 py-10 text-center text-[11px] text-muted-foreground"
                        colSpan={PURCHASE_CONTROL_COL_COUNT}
                      >
                        {replenishmentFilter === 'yellow'
                          ? 'Nenhum item em alerta de reposição (amarelo) neste momento. Use o ícone de filtro acima da tabela para mostrar todos ou as linhas verdes.'
                          : 'Nenhum item com ciclo de reposição confirmado (verde) neste momento. Use o ícone de filtro acima da tabela para mostrar todos ou as linhas amarelas.'}
                      </td>
                    </tr>
                  ) : (
                    visibleItems.map((row) => (
                      <PurchaseControlRow
                        key={`${row.id}-${row.updatedAt}-${String(row.plannedQuantity)}-${String(row.rubricMaxValue)}`}
                        confirmBusy={
                          confirmReplenishmentCycle.isPending &&
                          confirmReplenishmentCycle.variables === row.id
                        }
                        item={row}
                        onConfirmCycle={async () => {
                          await confirmReplenishmentCycle.mutateAsync(row.id);
                        }}
                        onPatch={patch}
                        onUnconfirmCycle={async () => {
                          await unconfirmReplenishmentCycle.mutateAsync(row.id);
                        }}
                        orgName={project.organizationName}
                        contractNumber={project.contractNumber}
                        plannedSignatureDate={project.plannedSignatureDate}
                        unconfirmBusy={
                          unconfirmReplenishmentCycle.isPending &&
                          unconfirmReplenishmentCycle.variables === row.id
                        }
                      />
                    ))
                  )}
                </tbody>
              </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function PurchaseControlRow({
  item,
  onPatch,
  onConfirmCycle,
  onUnconfirmCycle,
  confirmBusy,
  unconfirmBusy,
  orgName,
  contractNumber,
  plannedSignatureDate,
}: {
  item: BudgetItem;
  onPatch: (id: string, p: Partial<BudgetItemPayload>) => void;
  onConfirmCycle: () => Promise<void>;
  onUnconfirmCycle: () => Promise<void>;
  confirmBusy: boolean;
  unconfirmBusy: boolean;
  orgName: string;
  contractNumber: string | null;
  plannedSignatureDate: string | null;
}) {
  const ctx = item.contextOnly ?? false;
  const [confirmOpen, setConfirmOpen] = useState(false);
  /** Inclui campos que a API atualiza sem garantir `updatedAt` novo — evita inputs com defaultValue presos ao valor antigo. */
  const rk = `${item.id}-${item.updatedAt}-pq${String(item.plannedQuantity)}-rub${String(item.rubricMaxValue)}`;
  const valorTotalFase2 =
    item.plannedQuantity != null && item.actualUnitValue != null
      ? item.plannedQuantity * item.actualUnitValue
      : item.realTotalValue != null
        ? item.realTotalValue
        : null;
  const dataReposicaoPrevista = effectiveNextReplenishmentIso(item);
  const replenishmentAttention = isPendingReplenishmentRow(item);
  const canConfirmCycle = Boolean(
    dataReposicaoPrevista && !item.replenishmentCycleConfirmedAt && !ctx && replenishmentAttention,
  );
  const isGreenRow = Boolean(item.replenishmentCycleConfirmedAt);

  return (
    <tr
      className={cn(
        'hover:bg-muted/40',
        item.supplierQuoteExtraItem && !isGreenRow && !replenishmentAttention && 'bg-amber-50/80 hover:bg-amber-100/70',
        isGreenRow &&
          'bg-emerald-300/95 hover:bg-emerald-400/95 dark:bg-emerald-800/85 dark:hover:bg-emerald-700/90 ring-1 ring-inset ring-emerald-600/80 dark:ring-emerald-500/70',
        !isGreenRow &&
          replenishmentAttention &&
          'bg-amber-300/95 hover:bg-amber-400/95 dark:bg-amber-800/85 dark:hover:bg-amber-700/90 ring-1 ring-inset ring-amber-600/80 dark:ring-amber-500/70',
      )}
    >
      <td className={cn(cell, 'bg-muted/50 px-1.5 py-2 text-[11px] text-muted-foreground')}>{orgName}</td>
      <td className={cell}>
        <select
          key={`${rk}-cat`}
          className={cn(inp, 'cursor-pointer')}
          defaultValue={item.itemCategory}
          disabled={ctx}
          onChange={(e) => onPatch(item.id, { itemCategory: e.target.value as BudgetItemPayload['itemCategory'] })}
        >
          {['UNIFORM', 'EPI', 'EQUIPMENT', 'CONSUMABLE', 'OTHER'].map((c) => (
            <option key={c} value={c}>
              {getItemCategoryLabel(c as BudgetItem['itemCategory'])}
            </option>
          ))}
        </select>
      </td>
      <td className={cellText}>
        <textarea
          key={`${rk}-name`}
          className={cn(inp, textareaInp)}
          defaultValue={item.name}
          rows={2}
          onBlur={(e) => onPatch(item.id, { name: e.target.value.trim() || item.name })}
        />
        {item.supplierQuoteExtraItem ? (
          <div className="border-t border-amber-200/80 bg-amber-100/80 px-1.5 py-1 text-[10px] font-semibold text-amber-950">
            Não encontrada no edital, mas presente no orçamento
          </div>
        ) : null}
      </td>
      <td className={cellText}>
        <textarea
          key={`${rk}-spec`}
          className={cn(inp, textareaInp)}
          defaultValue={item.specification ?? ''}
          rows={3}
          spellCheck={false}
          onBlur={(e) => onPatch(item.id, { specification: e.target.value || null })}
        />
      </td>
      <td className={cellText}>
        <textarea
          key={`${rk}-size`}
          className={cn(
            inp,
            'min-h-[4.5rem] resize-y whitespace-pre-wrap text-center leading-snug [field-sizing:content] [overflow-wrap:anywhere]',
          )}
          defaultValue={item.sizeLabel ?? ''}
          rows={4}
          spellCheck={false}
          title="Shift+Enter: nova linha. Enter: salvar."
          onBlur={(e) => {
            const v = e.target.value;
            onPatch(item.id, { sizeLabel: v.trim() ? v : null });
          }}
          onKeyDown={sizeLabelKeyDown}
        />
      </td>
      <td className={cell}>
        <select
          key={`${rk}-ca`}
          className={cn(inp, 'cursor-pointer')}
          defaultValue={item.requiresCa === true ? 'yes' : item.requiresCa === false ? 'no' : ''}
          onChange={(e) =>
            onPatch(item.id, {
              requiresCa: e.target.value === 'yes' ? true : e.target.value === 'no' ? false : null,
            })
          }
        >
          <option value="">—</option>
          <option value="yes">Sim</option>
          <option value="no">Não</option>
        </select>
      </td>

      {/* Fase 2 — ordem fixa (22 colunas); CA só na Fase 1 */}
      <td className={cell}>
        <input
          key={`${rk}-f2-role`}
          className={inp}
          defaultValue={item.roleReference ?? ''}
          onBlur={(e) => onPatch(item.id, { roleReference: e.target.value || null })}
        />
      </td>
      <td className={cell}>
        <input
          key={`${rk}-f2-people`}
          className={cn(inp, 'text-center tabular-nums')}
          defaultValue={item.peopleCount ?? ''}
          inputMode="numeric"
          onBlur={(e) => onPatch(item.id, { peopleCount: intOrNull(e.target.value) })}
        />
      </td>
      <td className={cell}>
        <input
          key={`${rk}-f2-qtd`}
          className={cn(inp, 'text-center tabular-nums')}
          defaultValue={item.plannedQuantity ?? ''}
          disabled={ctx}
          inputMode="decimal"
          onBlur={(e) => onPatch(item.id, { plannedQuantity: numOrNull(e.target.value) })}
        />
      </td>
      <td className={cell}>
        <input
          key={`${rk}-f2-rubric`}
          className={cn(inp, 'text-right tabular-nums')}
          defaultValue={item.rubricMaxValue ?? ''}
          disabled={ctx}
          inputMode="decimal"
          onBlur={(e) => onPatch(item.id, { rubricMaxValue: numOrNull(e.target.value) })}
        />
      </td>
      <td className={cell}>
        <select
          key={`${rk}-f2-opst`}
          className={cn(inp, 'cursor-pointer')}
          defaultValue={normalizePurchaseStatusOption(item.operationalPurchaseStatus)}
          onChange={(e) => onPatch(item.id, { operationalPurchaseStatus: e.target.value || null })}
        >
          <option value="">—</option>
          {PURCHASE_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </td>
      <td className={cn(cell, 'bg-muted/50 px-1.5 py-2 text-[11px] text-muted-foreground')}>
        {formatDate(plannedSignatureDate)}
      </td>
      <td className={cell}>
        <input
          key={`${rk}-f2-edd`}
          className={cn(inp, 'text-center tabular-nums')}
          defaultValue={item.editalDeliveryDeadlineDays ?? ''}
          inputMode="numeric"
          onBlur={(e) => onPatch(item.id, { editalDeliveryDeadlineDays: intOrNull(e.target.value) })}
        />
      </td>
      <td className={cell}>
        <input
          key={`${rk}-f2-rpd`}
          className={cn(inp, 'text-center tabular-nums')}
          defaultValue={item.replenishmentPeriodDaysEdital ?? ''}
          inputMode="numeric"
          onBlur={(e) => onPatch(item.id, { replenishmentPeriodDaysEdital: intOrNull(e.target.value) })}
        />
      </td>
      <td className={cell}>
        <input
          key={`${rk}-f2-actual`}
          className={cn(inp, 'text-right tabular-nums')}
          defaultValue={item.actualUnitValue ?? ''}
          inputMode="decimal"
          onBlur={(e) => onPatch(item.id, { actualUnitValue: numOrNull(e.target.value) })}
        />
      </td>
      <td className={cn(cell, 'bg-muted/40 px-1.5 py-2 text-right tabular-nums text-muted-foreground')}>
        {valorTotalFase2 != null ? formatCurrency(valorTotalFase2) : '—'}
      </td>
      <td className={cell}>
        <input
          key={`${rk}-f2-supp`}
          className={inp}
          defaultValue={item.approvedSupplierName ?? ''}
          onBlur={(e) => onPatch(item.id, { approvedSupplierName: e.target.value || null })}
        />
      </td>
      <td className={cell}>
        <input
          key={`${rk}-f2-glpi`}
          className={inp}
          defaultValue={item.glpiTicketNumber ?? ''}
          onBlur={(e) => onPatch(item.id, { glpiTicketNumber: e.target.value || null })}
        />
      </td>
      <td className={cell}>
        <input
          key={`${rk}-f2-pay`}
          className={cn(inp, 'tabular-nums')}
          defaultValue={item.opPaymentSentAt?.slice(0, 10) ?? ''}
          type="date"
          onBlur={(e) => onPatch(item.id, { opPaymentSentAt: dateToIsoMidday(e.target.value) })}
        />
      </td>
      <td className={cell}>
        <input
          key={`${rk}-f2-exp`}
          className={cn(inp, 'tabular-nums')}
          defaultValue={item.opExpectedDeliveryAt?.slice(0, 10) ?? ''}
          type="date"
          onBlur={(e) => onPatch(item.id, { opExpectedDeliveryAt: dateToIsoMidday(e.target.value) })}
        />
      </td>
      <td className={cell}>
        <input
          key={`${rk}-f2-del`}
          className={cn(inp, 'tabular-nums')}
          defaultValue={item.opDeliveredAt?.slice(0, 10) ?? ''}
          title="Cada alteração grava a entrega e define a reposição em +6 meses."
          type="date"
          onChange={(e) => commitDeliveryAndReposicao(onPatch, item.id, e.target.value)}
          onBlur={(e) => commitDeliveryAndReposicao(onPatch, item.id, e.target.value)}
        />
      </td>
      <td className={cell}>
        <input
          key={`${rk}-f2-stg`}
          className={inp}
          defaultValue={item.operationalStagesStatus ?? ''}
          onBlur={(e) => onPatch(item.id, { operationalStagesStatus: e.target.value || null })}
        />
      </td>
      <td
        className={cn(cell, 'bg-muted/50 px-1.5 py-2')}
        title="Campo gravado na API ou entrega na unidade + 6 meses."
      >
        <span className="block min-h-8 tabular-nums text-[11px] leading-tight text-foreground">
          {dataReposicaoPrevista ? formatDate(dataReposicaoPrevista) : '—'}
        </span>
      </td>
      <td className={cn(cell, 'px-1 py-1 align-middle')}>
        {ctx ? (
          <span className="text-muted-foreground">—</span>
        ) : isGreenRow ? (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-emerald-950 dark:text-emerald-50">Confirmado</span>
            <Button
              className="h-7 min-h-7 px-1.5 text-[10px]"
              disabled={unconfirmBusy}
              onClick={() => void onUnconfirmCycle().catch(() => toast.error('Não foi possível desfazer.'))}
              size="sm"
              type="button"
              variant="outline"
            >
              {unconfirmBusy ? '…' : 'Desfazer'}
            </Button>
          </div>
        ) : canConfirmCycle ? (
          <>
            <Button
              className="h-7 min-h-7 px-1.5 text-[10px]"
              disabled={confirmBusy}
              onClick={() => setConfirmOpen(true)}
              size="sm"
              type="button"
              variant="secondary"
            >
              Confirmar…
            </Button>
            <Dialog onOpenChange={setConfirmOpen} open={confirmOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Confirmar reposição</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  O item foi realmente reposto? Será criada uma nova linha no topo para o próximo ciclo e esta linha
                  ficará registada como concluída. (A partir de 30 dias antes da data prevista até confirmar.)
                </p>
                <DialogFooter>
                  <Button onClick={() => setConfirmOpen(false)} type="button" variant="ghost">
                    Cancelar
                  </Button>
                  <Button
                    disabled={confirmBusy}
                    onClick={() => {
                      void onConfirmCycle()
                        .then(() => {
                          setConfirmOpen(false);
                          toast.success('Ciclo de reposição confirmado.');
                        })
                        .catch(() => toast.error('Não foi possível confirmar.'));
                    }}
                    type="button"
                  >
                    Sim, foi reposto
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        ) : dataReposicaoPrevista && !ctx ? (
          <span
            className="block px-0.5 text-[10px] leading-tight text-muted-foreground"
            title="A confirmação fica disponível a partir de 30 dias antes da data prevista e mantém-se até confirmar (incluindo em atraso)."
          >
            —
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className={cell}>
        <input
          key={`${rk}-f2-rsl`}
          className={inp}
          defaultValue={item.replenishmentStateLabel ?? ''}
          onBlur={(e) => onPatch(item.id, { replenishmentStateLabel: e.target.value || null })}
        />
      </td>
      <td className={cell}>
        <input
          key={`${rk}-f2-comp`}
          className={inp}
          defaultValue={item.competenceLabel ?? ''}
          placeholder="ex. 01/2025"
          onBlur={(e) => onPatch(item.id, { competenceLabel: e.target.value || null })}
        />
      </td>
      <td className={cn(cell, 'bg-muted/50 px-1.5 py-2 text-[11px] text-muted-foreground')}>
        {contractNumber || '—'}
      </td>
      <td className={cell}>
        <input
          key={`${rk}-f2-tax`}
          className={cn(inp, 'text-right tabular-nums')}
          defaultValue={item.administrativeFeePercent ?? ''}
          inputMode="decimal"
          onBlur={(e) => onPatch(item.id, { administrativeFeePercent: numOrNull(e.target.value) })}
        />
      </td>
      <td className={cellText}>
        <textarea
          key={`${rk}-f2-notes`}
          className={cn(inp, textareaInp)}
          defaultValue={item.notes ?? ''}
          rows={2}
          onBlur={(e) => onPatch(item.id, { notes: e.target.value || null })}
        />
      </td>
    </tr>
  );
}
