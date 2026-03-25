'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/empty-state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getItemCategoryLabel } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useBudgetItemsMutations, useBudgetItemsQuery } from '@/hooks/use-budget-items';
import { useProjectQuery } from '@/hooks/use-projects';
import type { BudgetItem } from '@/types/api';
import type { BudgetItemPayload } from '@/services/budget-items-service';

const cell =
  'max-w-0 overflow-hidden border-b border-r border-border p-0 align-top dark:border-border';
const inp =
  'box-border min-h-8 w-full min-w-0 border-0 bg-transparent px-1.5 py-1.5 text-[11px] leading-tight text-foreground outline-none focus:bg-muted focus:ring-1 focus:ring-inset focus:ring-primary/25';
const th =
  'relative border-b border-r border-border bg-muted px-1.5 py-2 text-left text-[9px] font-semibold uppercase tracking-wide text-muted-foreground';

/**
 * Faixa “Fase 1” = texto do edital (sem duplicar prioridade/função/qtd/rubrica — isso fica na Fase 2).
 * Fase 2 = colunas operacionais (ordem fixa do modelo “Projetos - Controles”).
 */
const FASE1_COL_COUNT = 6;
const FASE2_COL_COUNT = 23;
const PURCHASE_CONTROL_COL_COUNT = FASE1_COL_COUNT + FASE2_COL_COUNT;

/** Default column widths (px); must match column order in thead / tbody. */
const DEFAULT_COL_WIDTHS: number[] = [
  168, 84, 148, 120, 64, 72,
  132, 64, 72, 96, 72, 100, 96, 72, 72, 88, 88, 120, 88, 88, 88, 88, 88, 88, 88, 88, 88, 88, 140,
];

const FASE1_HEADERS: string[] = ['Órgão', 'Classif.', 'Descrição', 'Especificação', 'Tam.', 'Req. CA'];

/** Ordem exata solicitada para a Fase 2. */
const FASE2_HEADERS: string[] = [
  'Função (ões)',
  'Nº Pessoas',
  'Quantidade a ser comprada',
  'Rubrica (R$ valor na Licitação)',
  'Requer CA (Certificado de Aprovação)',
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
  'Status de Reposição',
  'Competência',
  'Número do contrato',
  'Taxa administrativa',
  'Observação',
];

const PURCHASE_CONTROL_HEADERS: string[] = [...FASE1_HEADERS, ...FASE2_HEADERS];

const COL_WIDTH_STORAGE_KEY = (projectId: string) => `purchase-control-col-widths:v3:${projectId}`;
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
  const projectQuery = useProjectQuery(projectId);
  const itemsQuery = useBudgetItemsQuery(projectId);
  const { updateItem } = useBudgetItemsMutations(projectId);

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

  async function patch(id: string, payload: Partial<BudgetItemPayload>) {
    try {
      await updateItem.mutateAsync({ id, payload });
    } catch {
      toast.error('Não foi possível salvar a célula.');
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
  const items = itemsQuery.data ?? [];

  return (
    <div className="page-sections space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Controle de compras</CardTitle>
          <CardDescription>
            Fase 1: texto do edital (6 colunas — sem duplicar dados já na Fase 2). Fase 2: operação (23 colunas).
            Alterações ao sair de cada campo. Arraste a borda entre colunas para redimensionar.
          </CardDescription>
        </CardHeader>
      </Card>

      {itemsQuery.isError ? (
        <EmptyState description="Tente novamente em instantes." title="Erro ao carregar itens" />
      ) : items.length === 0 ? (
        <EmptyState
          description="Aplique a extração do edital na revisão do documento ou cadastre itens em Itens orçados."
          title="Nenhum item neste projeto"
        />
      ) : (
        <Card className="overflow-hidden border-border/80 shadow-sm">
          <CardContent className="p-0">
            <div className="max-h-[min(78vh,920px)] w-full overflow-auto">
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
                      Fase 1 — Referência do edital
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
                  {items.map((row) => (
                    <PurchaseControlRow
                      key={row.id}
                      item={row}
                      onPatch={patch}
                      orgName={project.organizationName}
                      contractNumber={project.contractNumber}
                      plannedSignatureDate={project.plannedSignatureDate}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PurchaseControlRow({
  item,
  onPatch,
  orgName,
  contractNumber,
  plannedSignatureDate,
}: {
  item: BudgetItem;
  onPatch: (id: string, p: Partial<BudgetItemPayload>) => void;
  orgName: string;
  contractNumber: string | null;
  plannedSignatureDate: string | null;
}) {
  const ctx = item.contextOnly ?? false;
  const rk = `${item.id}-${item.updatedAt}`;
  const valorTotalFase2 =
    item.plannedQuantity != null && item.actualUnitValue != null
      ? item.plannedQuantity * item.actualUnitValue
      : item.realTotalValue != null
        ? item.realTotalValue
        : null;
  const dataReposicaoPrevista =
    item.opDeliveredAt != null ? nextReplenishmentIsoFromDelivered(item.opDeliveredAt) : null;

  return (
    <tr className="hover:bg-muted/40">
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
      <td className={cell}>
        <textarea
          key={`${rk}-name`}
          className={cn(inp, 'min-h-[2.5rem] resize-y')}
          defaultValue={item.name}
          rows={2}
          onBlur={(e) => onPatch(item.id, { name: e.target.value.trim() || item.name })}
        />
      </td>
      <td className={cell}>
        <textarea
          key={`${rk}-spec`}
          className={cn(inp, 'min-h-[2.5rem] resize-y')}
          defaultValue={item.specification ?? ''}
          rows={2}
          onBlur={(e) => onPatch(item.id, { specification: e.target.value || null })}
        />
      </td>
      <td className={cell}>
        <input
          key={`${rk}-size`}
          className={inp}
          defaultValue={item.sizeLabel ?? ''}
          onBlur={(e) => onPatch(item.id, { sizeLabel: e.target.value || null })}
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

      {/* Fase 2 — ordem fixa (23 colunas) */}
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
          key={`${rk}-f2-ca`}
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
      <td className={cell}>
        <input
          key={`${rk}-f2-opst`}
          className={inp}
          defaultValue={item.operationalPurchaseStatus ?? ''}
          onBlur={(e) => onPatch(item.id, { operationalPurchaseStatus: e.target.value || null })}
        />
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
        title="Calculada automaticamente: data de entrega na unidade + 6 meses."
      >
        <span className="block min-h-8 tabular-nums text-[11px] leading-tight text-foreground">
          {dataReposicaoPrevista ? formatDate(dataReposicaoPrevista) : '—'}
        </span>
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
      <td className={cell}>
        <textarea
          key={`${rk}-f2-notes`}
          className={cn(inp, 'min-h-[2.5rem] resize-y')}
          defaultValue={item.notes ?? ''}
          rows={2}
          onBlur={(e) => onPatch(item.id, { notes: e.target.value || null })}
        />
      </td>
    </tr>
  );
}
