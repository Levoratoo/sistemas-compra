import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma.js';
import { projectRepository } from '../repositories/project.repository.js';
import { supplierRepository } from '../repositories/supplier.repository.js';
import { AppError } from '../utils/app-error.js';
import { decimalToNumber, toDecimal } from '../utils/decimal.js';
import { toIsoString } from '../utils/date.js';
import { serializeSupplier } from '../utils/serializers.js';
import type {
  ApplyQuoteWinnerInput,
  UpdateQuoteItemInput,
  UpdateQuoteSupplierInput,
} from '../modules/quote/quote.schemas.js';

const QUOTE_SLOT_NUMBERS = [1, 2, 3] as const;
const QUOTE_EPSILON = 0.000001;

const quoteInclude = {
  supplier: true,
  items: true,
} satisfies Prisma.ProjectQuoteInclude;

const quoteBudgetItemSelect = {
  id: true,
  name: true,
  specification: true,
  unit: true,
  itemCategory: true,
  plannedQuantity: true,
  createdAt: true,
} satisfies Prisma.BudgetItemSelect;

type QuoteRecord = Prisma.ProjectQuoteGetPayload<{
  include: typeof quoteInclude;
}>;

type QuoteBudgetItem = Prisma.BudgetItemGetPayload<{
  select: typeof quoteBudgetItemSelect;
}>;

type QuoteRowValue = {
  projectQuoteId: string;
  slotNumber: number;
  supplierId: string | null;
  supplierName: string | null;
  unitPrice: number | null;
  totalValue: number | null;
  notes: string | null;
  updatedAt: string | null;
};

type QuoteWinnerStatus = 'NONE' | 'UNIQUE' | 'TIE';

type QuoteRowWinner = {
  status: QuoteWinnerStatus;
  slotNumbers: number[];
  unitPrice: number | null;
  totalValue: number | null;
};

function supplierDisplayName(supplier: QuoteRecord['supplier'] | null) {
  return supplier?.tradeName?.trim() || supplier?.legalName?.trim() || null;
}

function hasMeaningfulQuoteItemData(item: QuoteRecord['items'][number]) {
  return decimalToNumber(item.unitPrice) !== null || Boolean(item.notes?.trim());
}

function calcRowTotal(quantity: number | null, unitPrice: number | null) {
  if (quantity === null || unitPrice === null) {
    return null;
  }
  return quantity * unitPrice;
}

function sameMoney(left: number, right: number) {
  return Math.abs(left - right) <= QUOTE_EPSILON;
}

function buildRowWinner(values: QuoteRowValue[]): QuoteRowWinner {
  const priced = values.filter((value) => value.unitPrice !== null && value.totalValue !== null);

  if (priced.length === 0) {
    return {
      status: 'NONE',
      slotNumbers: [],
      unitPrice: null,
      totalValue: null,
    };
  }

  const minTotal = Math.min(...priced.map((value) => value.totalValue as number));
  const winners = priced.filter((value) => sameMoney(value.totalValue as number, minTotal));

  if (winners.length === 1) {
    return {
      status: 'UNIQUE',
      slotNumbers: [winners[0]?.slotNumber ?? 0],
      unitPrice: winners[0]?.unitPrice ?? null,
      totalValue: winners[0]?.totalValue ?? null,
    };
  }

  return {
    status: 'TIE',
    slotNumbers: winners.map((winner) => winner.slotNumber),
    unitPrice: winners[0]?.unitPrice ?? null,
    totalValue: winners[0]?.totalValue ?? null,
  };
}

export function buildQuoteState(projectId: string, budgetItems: QuoteBudgetItem[], quotes: QuoteRecord[]) {
  const quoteBySlot = new Map(quotes.map((quote) => [quote.slotNumber, quote]));

  const rows = budgetItems.map((item) => {
    const quantity = decimalToNumber(item.plannedQuantity);
    const values: QuoteRowValue[] = QUOTE_SLOT_NUMBERS.map((slotNumber) => {
      const quote = quoteBySlot.get(slotNumber);
      const quoteItem = quote?.items.find((entry) => entry.budgetItemId === item.id) ?? null;
      const unitPrice = decimalToNumber(quoteItem?.unitPrice);

      return {
        projectQuoteId: quote?.id ?? '',
        slotNumber,
        supplierId: quote?.supplierId ?? null,
        supplierName: supplierDisplayName(quote?.supplier ?? null),
        unitPrice,
        totalValue: calcRowTotal(quantity, unitPrice),
        notes: quoteItem?.notes ?? null,
        updatedAt: toIsoString(quoteItem?.updatedAt),
      };
    });

    return {
      budgetItemId: item.id,
      description: item.name,
      specification: item.specification ?? null,
      quantity,
      unit: item.unit ?? null,
      itemCategory: item.itemCategory,
      values,
      winner: buildRowWinner(values),
    };
  });

  const slots = QUOTE_SLOT_NUMBERS.map((slotNumber) => {
    const quote = quoteBySlot.get(slotNumber);
    const filledItemCount = rows.reduce((total, row) => {
      const value = row.values.find((entry) => entry.slotNumber === slotNumber);
      return total + (value?.unitPrice !== null ? 1 : 0);
    }, 0);
    const totals = rows
      .map((row) => row.values.find((entry) => entry.slotNumber === slotNumber)?.totalValue ?? null)
      .filter((value): value is number => value !== null);
    const itemCount = rows.length;
    const totalValue = totals.length > 0 ? totals.reduce((sum, value) => sum + value, 0) : null;
    const isComplete = Boolean(quote?.supplierId) && itemCount > 0 && filledItemCount === itemCount;

    return {
      id: quote?.id ?? '',
      projectId,
      slotNumber,
      supplierId: quote?.supplierId ?? null,
      supplier: quote?.supplier ? serializeSupplier(quote.supplier) : null,
      itemCount,
      filledItemCount,
      totalValue,
      isComplete,
      createdAt: toIsoString(quote?.createdAt),
      updatedAt: toIsoString(quote?.updatedAt),
    };
  });

  const completeTotals = slots.filter((slot) => slot.isComplete && slot.totalValue !== null);

  let overallWinner: {
    status: QuoteWinnerStatus;
    slotNumbers: number[];
    totalValue: number | null;
  } = {
    status: 'NONE',
    slotNumbers: [],
    totalValue: null,
  };

  if (completeTotals.length > 0) {
    const minTotal = Math.min(...completeTotals.map((slot) => slot.totalValue as number));
    const winners = completeTotals.filter((slot) => sameMoney(slot.totalValue as number, minTotal));

    overallWinner =
      winners.length === 1
        ? {
            status: 'UNIQUE',
            slotNumbers: [winners[0]?.slotNumber ?? 0],
            totalValue: winners[0]?.totalValue ?? null,
          }
        : {
            status: 'TIE',
            slotNumbers: winners.map((winner) => winner.slotNumber),
            totalValue: winners[0]?.totalValue ?? null,
          };
  }

  return {
    projectId,
    slots,
    rows,
    comparison: {
      slotTotals: slots.map((slot) => ({
        slotNumber: slot.slotNumber,
        supplierId: slot.supplierId,
        supplierName: slot.supplier?.tradeName || slot.supplier?.legalName || null,
        totalValue: slot.totalValue,
        itemCount: slot.itemCount,
        filledItemCount: slot.filledItemCount,
        isComplete: slot.isComplete,
      })),
      overallWinner,
      resolvedRowCount: rows.filter((row) => row.winner.status === 'UNIQUE').length,
      tieRowCount: rows.filter((row) => row.winner.status === 'TIE').length,
      unresolvedRowCount: rows.filter((row) => row.winner.status === 'NONE').length,
    },
  };
}

async function ensureProjectExists(projectId: string) {
  const project = await projectRepository.exists(projectId);

  if (!project) {
    throw new AppError('Project not found', 404);
  }
}

async function ensureQuoteSlots(projectId: string) {
  await prisma.projectQuote.createMany({
    data: QUOTE_SLOT_NUMBERS.map((slotNumber) => ({
      projectId,
      slotNumber,
    })),
    skipDuplicates: true,
  });
}

async function findQuoteBudgetItems(projectId: string) {
  return prisma.budgetItem.findMany({
    where: {
      projectId,
      contextOnly: false,
    },
    select: quoteBudgetItemSelect,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
}

async function findQuoteRecords(projectId: string) {
  return prisma.projectQuote.findMany({
    where: { projectId },
    include: quoteInclude,
    orderBy: { slotNumber: 'asc' },
  });
}

async function buildProjectQuoteState(projectId: string) {
  await ensureProjectExists(projectId);
  await ensureQuoteSlots(projectId);

  const [budgetItems, quotes] = await Promise.all([findQuoteBudgetItems(projectId), findQuoteRecords(projectId)]);

  return buildQuoteState(projectId, budgetItems, quotes);
}

async function findQuoteBySlot(projectId: string, slotNumber: number) {
  await ensureQuoteSlots(projectId);

  const quote = await prisma.projectQuote.findUnique({
    where: {
      projectId_slotNumber: {
        projectId,
        slotNumber,
      },
    },
    include: quoteInclude,
  });

  if (!quote) {
    throw new AppError('Quote slot not found', 404);
  }

  return quote;
}

async function findQuoteBudgetItem(projectId: string, budgetItemId: string) {
  const item = await prisma.budgetItem.findFirst({
    where: {
      id: budgetItemId,
      projectId,
      contextOnly: false,
    },
    select: quoteBudgetItemSelect,
  });

  if (!item) {
    throw new AppError('Budget item not found in this project', 404);
  }

  return item;
}

function normalizeQuoteNotes(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

class QuoteService {
  async listProjectQuotes(projectId: string) {
    return buildProjectQuoteState(projectId);
  }

  async updateQuoteSupplier(projectId: string, slotNumber: number, input: UpdateQuoteSupplierInput) {
    await ensureProjectExists(projectId);

    if (input.supplierId) {
      const supplier = await supplierRepository.findById(input.supplierId);
      if (!supplier) {
        throw new AppError('Supplier not found', 404);
      }
    }

    const quote = await findQuoteBySlot(projectId, slotNumber);
    const nextSupplierId = input.supplierId ?? null;
    const isChangingSupplier = quote.supplierId !== nextSupplierId;
    const hasSavedValues = quote.items.some(hasMeaningfulQuoteItemData);

    if (isChangingSupplier && hasSavedValues && !input.confirmReset) {
      throw new AppError(
        'Trocar o fornecedor limpa os valores e observações deste orçamento. Confirme a operação para continuar.',
        409,
      );
    }

    await prisma.$transaction(async (tx) => {
      if (isChangingSupplier && hasSavedValues) {
        await tx.projectQuoteItem.deleteMany({
          where: { projectQuoteId: quote.id },
        });
      }

      await tx.projectQuote.update({
        where: { id: quote.id },
        data: {
          supplierId: nextSupplierId,
        },
      });
    });

    return buildProjectQuoteState(projectId);
  }

  async updateQuoteItem(
    projectId: string,
    slotNumber: number,
    budgetItemId: string,
    input: UpdateQuoteItemInput,
  ) {
    await ensureProjectExists(projectId);

    const [quote] = await Promise.all([
      findQuoteBySlot(projectId, slotNumber),
      findQuoteBudgetItem(projectId, budgetItemId),
    ]);

    if (!quote.supplierId) {
      throw new AppError('Selecione um fornecedor para este orçamento antes de preencher valores.', 409);
    }

    const existing = await prisma.projectQuoteItem.findUnique({
      where: {
        projectQuoteId_budgetItemId: {
          projectQuoteId: quote.id,
          budgetItemId,
        },
      },
    });

    const nextUnitPrice =
      input.unitPrice !== undefined ? input.unitPrice : decimalToNumber(existing?.unitPrice);
    const nextNotes =
      input.notes !== undefined ? normalizeQuoteNotes(input.notes) : (existing?.notes ?? null);

    if (nextUnitPrice === null && !nextNotes) {
      if (existing) {
        await prisma.projectQuoteItem.delete({
          where: { id: existing.id },
        });
      }

      return buildProjectQuoteState(projectId);
    }

    await prisma.projectQuoteItem.upsert({
      where: {
        projectQuoteId_budgetItemId: {
          projectQuoteId: quote.id,
          budgetItemId,
        },
      },
      create: {
        projectQuoteId: quote.id,
        budgetItemId,
        unitPrice: toDecimal(nextUnitPrice),
        notes: nextNotes,
      },
      update: {
        unitPrice: toDecimal(nextUnitPrice),
        notes: nextNotes,
      },
    });

    return buildProjectQuoteState(projectId);
  }

  async applyQuoteWinner(projectId: string, input: ApplyQuoteWinnerInput) {
    const state = await buildProjectQuoteState(projectId);
    const slotMap = new Map<number, (typeof state.slots)[number]>(state.slots.map((slot) => [slot.slotNumber, slot]));

    const rowsToApply =
      input.mode === 'OVERALL'
        ? (() => {
            if (state.comparison.overallWinner.status !== 'UNIQUE') {
              throw new AppError('Não existe vencedor geral único para aplicar.', 409);
            }

            const winnerSlot = state.comparison.overallWinner.slotNumbers[0];
            const slot = winnerSlot ? slotMap.get(winnerSlot) : null;
            if (!slot?.supplier?.legalName) {
              throw new AppError('O orçamento vencedor geral não possui fornecedor válido.', 409);
            }

            const approvedSupplierName = slot.supplier.legalName;

            return state.rows
              .map((row) => {
                const value = row.values.find((entry) => entry.slotNumber === winnerSlot) ?? null;
                if (!value || value.unitPrice === null || value.totalValue === null) {
                  return null;
                }

                return {
                  budgetItemId: row.budgetItemId,
                  approvedSupplierName,
                  actualUnitValue: value.unitPrice,
                  purchasedValue: value.totalValue,
                };
              })
              .filter((row): row is NonNullable<typeof row> => row !== null);
          })()
        : state.rows
            .map((row) => {
              if (row.winner.status !== 'UNIQUE') {
                return null;
              }

              const winnerSlot = row.winner.slotNumbers[0];
              const slot = winnerSlot ? slotMap.get(winnerSlot) : null;
              const value = row.values.find((entry) => entry.slotNumber === winnerSlot) ?? null;

              if (!slot?.supplier?.legalName || !value || value.unitPrice === null || value.totalValue === null) {
                return null;
              }

              return {
                budgetItemId: row.budgetItemId,
                approvedSupplierName: slot.supplier.legalName,
                actualUnitValue: value.unitPrice,
                purchasedValue: value.totalValue,
              };
            })
            .filter((row): row is NonNullable<typeof row> => row !== null);

    if (rowsToApply.length === 0) {
      throw new AppError('Nenhum item elegível para aplicar com o modo selecionado.', 409);
    }

    await prisma.$transaction(async (tx) => {
      await Promise.all(
        rowsToApply.map((row) =>
          tx.budgetItem.update({
            where: { id: row.budgetItemId },
            data: {
              approvedSupplierName: row.approvedSupplierName,
              actualUnitValue: toDecimal(row.actualUnitValue),
              purchasedValue: toDecimal(row.purchasedValue),
            },
          }),
        ),
      );
    });

    return {
      mode: input.mode,
      updatedItems: rowsToApply.length,
      skippedItems: Math.max(0, state.rows.length - rowsToApply.length),
    };
  }
}

export const quoteService = new QuoteService();
