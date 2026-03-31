import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma.js';
import { documentFolderRepository } from '../repositories/document-folder.repository.js';
import { projectRepository } from '../repositories/project.repository.js';
import { purchaseRepository } from '../repositories/purchase.repository.js';
import { supplierRepository } from '../repositories/supplier.repository.js';
import type {
  ApplyQuoteWinnerInput,
  GenerateQuotePurchaseOrderInput,
  UpdateQuoteItemInput,
  UpdateQuoteSupplierInput,
} from '../modules/quote/quote.schemas.js';
import { AppError } from '../utils/app-error.js';
import { parseOptionalDate, toIsoString } from '../utils/date.js';
import { decimalToNumber, toDecimal } from '../utils/decimal.js';
import { serializeSupplier } from '../utils/serializers.js';
import { buildPurchaseOrderPdf, buildPurchaseOrderSearchText } from '../utils/purchase-order-pdf.js';
import { documentService } from './document.service.js';

const QUOTE_SLOT_NUMBERS = [1, 2, 3] as const;
const QUOTE_EPSILON = 0.000001;
const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';
const MONTH_LABELS_PT_BR = [
  'Janeiro',
  'Fevereiro',
  'Marco',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

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

type QuoteProjectContext = {
  id: string;
  code: string;
  name: string;
  organizationName: string;
  city: string | null;
  state: string | null;
  selectedQuoteSlotNumber: number | null;
};

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

type QuotePurchaseOrderRow = {
  budgetItemId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  notes: string | null;
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

function normalizeQuoteNotes(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function sanitizeDocumentSegment(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/-+/g, '-')
    .replace(/^[_-]+|[_-]+$/g, '')
    .trim();

  return normalized || 'DOCUMENTO';
}

function formatDateLabel(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      return `${dateOnlyMatch[3]}/${dateOnlyMatch[2]}/${dateOnlyMatch[1]}`;
    }
  }

  const parsedDate = parseOptionalDate(value);
  if (!parsedDate) {
    return null;
  }

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: SAO_PAULO_TIME_ZONE,
  }).format(parsedDate);
}

function parseDateInputInSaoPaulo(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    return toSaoPauloNoonDate(`${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}`);
  }

  return parseOptionalDate(value);
}

function getSaoPauloNowParts(referenceDate = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(referenceDate);
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  const monthIndex = Math.max(0, Math.min(11, Number(month) - 1));

  return {
    year,
    month,
    day,
    isoDate: `${year}-${month}-${day}`,
    label: `${day}/${month}/${year}`,
    monthFolderName: `${year}-${month} - ${MONTH_LABELS_PT_BR[monthIndex]}`,
  };
}

function toSaoPauloNoonDate(isoDate: string) {
  return new Date(`${isoDate}T12:00:00-03:00`);
}

function buildPurchaseOrderRows(
  rows: ReturnType<typeof buildQuoteState>['rows'],
  slotNumber: number,
): QuotePurchaseOrderRow[] {
  return rows
    .map((row) => {
      const value = row.values.find((entry) => entry.slotNumber === slotNumber) ?? null;

      if (
        !value ||
        value.unitPrice === null ||
        value.totalValue === null ||
        row.quantity === null ||
        row.quantity <= 0
      ) {
        return null;
      }

      return {
        budgetItemId: row.budgetItemId,
        description: row.description,
        quantity: row.quantity,
        unitPrice: value.unitPrice,
        totalValue: value.totalValue,
        notes: value.notes ?? null,
      };
    })
    .filter((row): row is QuotePurchaseOrderRow => row !== null);
}

export function buildQuoteState(
  projectId: string,
  budgetItems: QuoteBudgetItem[],
  quotes: QuoteRecord[],
  selectedSlotNumber: number | null,
) {
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
      isSelected: selectedSlotNumber === slotNumber,
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
    selectedSlotNumber,
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

async function findQuoteProjectContext(projectId: string): Promise<QuoteProjectContext> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      code: true,
      name: true,
      organizationName: true,
      city: true,
      state: true,
      selectedQuoteSlotNumber: true,
    },
  });

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  return project;
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
  const project = await findQuoteProjectContext(projectId);
  await ensureQuoteSlots(projectId);

  const [budgetItems, quotes] = await Promise.all([findQuoteBudgetItems(projectId), findQuoteRecords(projectId)]);

  return buildQuoteState(projectId, budgetItems, quotes, project.selectedQuoteSlotNumber);
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

async function ensureDocumentFolder(projectId: string, parentId: string | null, name: string) {
  const existing = await documentFolderRepository.findByProjectParentAndName(projectId, parentId, name);
  if (existing) {
    return existing;
  }

  return documentFolderRepository.create({
    projectId,
    parentId,
    name,
  });
}

async function ensurePurchaseOrderFolders(projectId: string, monthFolderName: string) {
  const rootFolder = await ensureDocumentFolder(projectId, null, 'Ordens de compra');
  const monthFolder = await ensureDocumentFolder(projectId, rootFolder.id, monthFolderName);

  return {
    rootFolder,
    monthFolder,
  };
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
        'Trocar o fornecedor limpa os valores e observacoes deste orcamento. Confirme a operacao para continuar.',
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
      throw new AppError('Selecione um fornecedor para este orcamento antes de preencher valores.', 409);
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

  async selectQuoteSlot(projectId: string, slotNumber: number) {
    await ensureProjectExists(projectId);
    await findQuoteBySlot(projectId, slotNumber);

    await prisma.project.update({
      where: { id: projectId },
      data: {
        selectedQuoteSlotNumber: slotNumber,
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
              throw new AppError('Nao existe vencedor geral unico para aplicar.', 409);
            }

            const winnerSlot = state.comparison.overallWinner.slotNumbers[0];
            const slot = winnerSlot ? slotMap.get(winnerSlot) : null;
            if (!slot?.supplier?.legalName) {
              throw new AppError('O orcamento vencedor geral nao possui fornecedor valido.', 409);
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
      throw new AppError('Nenhum item elegivel para aplicar com o modo selecionado.', 409);
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

  async generatePurchaseOrderDocument(projectId: string, input: GenerateQuotePurchaseOrderInput) {
    const [project, budgetItems, quotes] = await Promise.all([
      findQuoteProjectContext(projectId),
      findQuoteBudgetItems(projectId),
      (async () => {
        await ensureQuoteSlots(projectId);
        return findQuoteRecords(projectId);
      })(),
    ]);

    if (!project.selectedQuoteSlotNumber) {
      throw new AppError('Selecione um orcamento antes de gerar a ordem de compra.', 409);
    }

    const state = buildQuoteState(
      projectId,
      budgetItems,
      quotes,
      project.selectedQuoteSlotNumber,
    );
    const selectedSlot = state.slots.find((slot) => slot.slotNumber === project.selectedQuoteSlotNumber) ?? null;
    const selectedQuote =
      quotes.find((quote) => quote.slotNumber === project.selectedQuoteSlotNumber) ?? null;

    if (!selectedSlot || !selectedQuote || !selectedQuote.supplier) {
      throw new AppError('O orcamento selecionado precisa ter um fornecedor valido.', 409);
    }

    const purchaseOrderRows = buildPurchaseOrderRows(state.rows, selectedSlot.slotNumber);
    if (purchaseOrderRows.length === 0) {
      throw new AppError('O orcamento selecionado nao possui itens com preco para gerar a ordem.', 409);
    }

    const saoPauloNow = getSaoPauloNowParts();
    const issuedAt = toSaoPauloNoonDate(saoPauloNow.isoDate);
    const expectedDeliveryDate = parseDateInputInSaoPaulo(input.expectedDeliveryDate ?? null);
    const { monthFolder } = await ensurePurchaseOrderFolders(projectId, saoPauloNow.monthFolderName);

    const existingOrder = await purchaseRepository.findOrderByProjectAndGlpi(projectId, input.glpiNumber);
    const order =
      existingOrder === null
        ? await purchaseRepository.createOrder({
            projectId,
            supplierId: selectedQuote.supplierId,
            purchaseStatus: 'TO_START',
            purchaseDate: issuedAt,
            internalReference: normalizeOptionalText(input.internalReference),
            glpiNumber: input.glpiNumber,
            deliveryAddress: normalizeOptionalText(input.deliveryAddress),
            freightType: normalizeOptionalText(input.freightType),
            paymentTerms: normalizeOptionalText(input.paymentTerms),
            responsibleName: normalizeOptionalText(input.responsibleName),
            responsiblePhone: normalizeOptionalText(input.responsiblePhone),
            expectedDeliveryDate,
            notes: normalizeOptionalText(input.notes),
          })
        : await purchaseRepository.updateOrder(existingOrder.id, {
            supplierId: selectedQuote.supplierId,
            purchaseDate: issuedAt,
            internalReference: normalizeOptionalText(input.internalReference),
            glpiNumber: input.glpiNumber,
            deliveryAddress: normalizeOptionalText(input.deliveryAddress),
            freightType: normalizeOptionalText(input.freightType),
            paymentTerms: normalizeOptionalText(input.paymentTerms),
            responsibleName: normalizeOptionalText(input.responsibleName),
            responsiblePhone: normalizeOptionalText(input.responsiblePhone),
            expectedDeliveryDate,
            notes: normalizeOptionalText(input.notes),
          });

    await purchaseRepository.replaceOrderItems(
      order.id,
      purchaseOrderRows.map((row) => ({
        purchaseOrderId: order.id,
        budgetItemId: row.budgetItemId,
        quantityPurchased: toDecimal(row.quantity) ?? new Prisma.Decimal(0),
        realUnitValue: toDecimal(row.unitPrice) ?? new Prisma.Decimal(0),
        expectedDeliveryDate,
        deliveredAt: null,
        deliveryStatus: 'NOT_SCHEDULED',
        notes: row.notes,
      })),
    );

    const supplierName =
      selectedQuote.supplier.tradeName?.trim() ||
      selectedQuote.supplier.legalName?.trim() ||
      'Fornecedor';
    const projectFileSegment = sanitizeDocumentSegment(
      (project.code?.trim() || project.name?.trim() || 'PROJETO').toUpperCase(),
    );
    const glpiSegment = sanitizeDocumentSegment(input.glpiNumber);
    const fileName = `${projectFileSegment}_${glpiSegment}_${saoPauloNow.isoDate}.pdf`;

    const pdfInput = {
      issuerName: project.organizationName,
      issuerCity: project.city,
      issuerState: project.state,
      projectCode: project.code,
      projectName: project.name,
      supplierName,
      supplierDocumentNumber: selectedQuote.supplier.documentNumber ?? null,
      supplierAddress: selectedQuote.supplier.address ?? null,
      supplierContactName: selectedQuote.supplier.contactName ?? null,
      supplierPhone: selectedQuote.supplier.phone ?? null,
      glpiNumber: input.glpiNumber,
      internalReference: normalizeOptionalText(input.internalReference),
      issuedAtLabel: saoPauloNow.label,
      expectedDeliveryDateLabel: formatDateLabel(input.expectedDeliveryDate),
      deliveryAddress: normalizeOptionalText(input.deliveryAddress),
      freightType: normalizeOptionalText(input.freightType),
      paymentTerms: normalizeOptionalText(input.paymentTerms),
      responsibleName: normalizeOptionalText(input.responsibleName),
      responsiblePhone: normalizeOptionalText(input.responsiblePhone),
      notes: normalizeOptionalText(input.notes),
      items: purchaseOrderRows.map((row) => ({
        description: row.description,
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        totalPrice: row.totalValue,
        notes: row.notes,
      })),
    } satisfies Parameters<typeof buildPurchaseOrderPdf>[0];

    const pdfBytes = await buildPurchaseOrderPdf(pdfInput);
    const searchText = buildPurchaseOrderSearchText(pdfInput);
    const documentPayload = {
      folderId: monthFolder.id,
      purchaseOrderId: order.id,
      documentType: 'PURCHASE_ORDER_PDF' as const,
      originalFileName: fileName,
      mimeType: 'application/pdf',
      documentDate: issuedAt.toISOString(),
      contentText: searchText,
      searchText,
      notes: normalizeOptionalText(input.notes) ?? undefined,
      processingStatus: 'PROCESSED' as const,
      reviewStatus: 'REVIEWED' as const,
      originalFileBuffer: Buffer.from(pdfBytes),
    };

    const document =
      order.generatedDocumentId && order.generatedDocument
        ? await documentService.replaceProjectDocument(projectId, order.generatedDocumentId, documentPayload)
        : await documentService.createProjectDocument(projectId, documentPayload);

    const updatedOrder =
      order.generatedDocumentId === document.id
        ? order
        : await purchaseRepository.updateOrder(order.id, {
            generatedDocumentId: document.id,
          });

    return {
      slotNumber: selectedSlot.slotNumber,
      purchaseOrderId: updatedOrder.id,
      documentId: document.id,
      documentFileName: document.originalFileName,
      folderPathLabel: document.folderPathLabel ?? null,
    };
  }
}

export const quoteService = new QuoteService();
