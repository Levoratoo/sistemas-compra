import type { Express } from 'express';
import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma.js';
import { documentFolderRepository } from '../repositories/document-folder.repository.js';
import { projectRepository } from '../repositories/project.repository.js';
import { purchaseRepository } from '../repositories/purchase.repository.js';
import { supplierRepository } from '../repositories/supplier.repository.js';
import type {
  ApplyQuoteWinnerInput,
  ApplyQuoteImportInput,
  GenerateQuotePurchaseOrderInput,
  UpdateQuoteItemInput,
  UpdateQuoteSupplierInput,
} from '../modules/quote/quote.schemas.js';
import { AppError } from '../utils/app-error.js';
import { parseOptionalDate, toIsoString } from '../utils/date.js';
import { decimalToNumber, toDecimal } from '../utils/decimal.js';
import { serializeProjectDocument, serializeSupplier } from '../utils/serializers.js';
import { buildPurchaseOrderPdf, buildPurchaseOrderSearchText } from '../utils/purchase-order-pdf.js';
import {
  extractSupplierQuotePdfPreview,
  normalizeSupplierQuoteMatchText,
  tokenizeSupplierQuoteMatchText,
  type SupplierQuoteExtractionMode,
} from '../utils/supplier-quote-pdf.js';
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
  latestImportedDocument: true,
} satisfies Prisma.ProjectQuoteInclude;

const quoteBudgetItemSelect = {
  id: true,
  name: true,
  specification: true,
  unit: true,
  itemCategory: true,
  plannedQuantity: true,
  supplierQuoteExtraItem: true,
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

type QuoteImportConfidence = 'HIGH' | 'REVIEW' | 'UNMATCHED';
type QuoteImportAction = 'APPLY' | 'IGNORE' | 'CREATE_EXTRA';

type QuoteImportCandidateMatch = {
  budgetItemId: string;
  name: string;
  specification: string | null;
  score: number;
};

type QuoteImportPreviewRow = {
  rowIndex: number;
  rawText: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number;
  totalValue: number | null;
  confidence: QuoteImportConfidence;
  quantityConflict: boolean;
  matchedBudgetItemId: string | null;
  matchedBudgetItemName: string | null;
  matchScore: number | null;
  suggestedAction: QuoteImportAction;
  requiresNameValidation: boolean;
  candidateMatches: QuoteImportCandidateMatch[];
};

type StoredQuoteImportPreview = {
  kind: 'SUPPLIER_QUOTE_IMPORT';
  projectId: string;
  slotNumber: number;
  supplierId: string;
  supplierName: string;
  extractionMode: SupplierQuoteExtractionMode;
  quoteNumber: string | null;
  quoteDate: string | null;
  detectedSupplierName: string | null;
  importedAt: string;
  rows: QuoteImportPreviewRow[];
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

function buildBudgetItemMatchText(item: QuoteBudgetItem) {
  return [item.name, item.specification, item.unit].filter(Boolean).join(' ');
}

function calculateTokenOverlapScore(left: string[], right: string[]) {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const intersection = [...leftSet].filter((token) => rightSet.has(token)).length;

  if (intersection === 0) {
    return 0;
  }

  return intersection / Math.max(leftSet.size, rightSet.size);
}

function quantityConflictWithBudgetItem(importedQuantity: number | null, budgetQuantity: number | null) {
  if (importedQuantity === null || budgetQuantity === null || importedQuantity <= 0 || budgetQuantity <= 0) {
    return false;
  }

  return !sameMoney(importedQuantity, budgetQuantity);
}

function scoreQuoteImportMatch(
  row: Pick<QuoteImportPreviewRow, 'description' | 'quantity'>,
  item: QuoteBudgetItem,
) {
  const rowNormalized = normalizeSupplierQuoteMatchText(row.description);
  const itemNormalized = normalizeSupplierQuoteMatchText(buildBudgetItemMatchText(item));
  const rowTokens = tokenizeSupplierQuoteMatchText(row.description);
  const itemTokens = tokenizeSupplierQuoteMatchText(buildBudgetItemMatchText(item));
  const overlapScore = calculateTokenOverlapScore(rowTokens, itemTokens);
  const quantityConflict = quantityConflictWithBudgetItem(row.quantity, decimalToNumber(item.plannedQuantity));

  let score = overlapScore;

  if (rowNormalized && itemNormalized) {
    if (rowNormalized === itemNormalized) {
      score = 1;
    } else if (
      rowNormalized.length >= 8 &&
      itemNormalized.length >= 8 &&
      (rowNormalized.includes(itemNormalized) || itemNormalized.includes(rowNormalized))
    ) {
      score = Math.max(score, 0.93);
    }
  }

  if (quantityConflict && score >= 0.8) {
    score = Math.max(0.55, score - 0.2);
  }

  return {
    score,
    quantityConflict,
  };
}

function rankQuoteImportMatches(
  row: Pick<QuoteImportPreviewRow, 'description' | 'quantity'>,
  budgetItems: QuoteBudgetItem[],
) {
  return budgetItems
    .map((item) => ({
      item,
      ...scoreQuoteImportMatch(row, item),
    }))
    .sort((left, right) => right.score - left.score);
}

function buildQuoteImportPreviewRow(
  row: Omit<
    QuoteImportPreviewRow,
    | 'confidence'
    | 'quantityConflict'
    | 'matchedBudgetItemId'
    | 'matchedBudgetItemName'
    | 'matchScore'
    | 'suggestedAction'
    | 'requiresNameValidation'
    | 'candidateMatches'
  >,
  budgetItems: QuoteBudgetItem[],
): QuoteImportPreviewRow {
  const ranked = rankQuoteImportMatches(row, budgetItems);

  const best = ranked[0] ?? null;
  const second = ranked[1] ?? null;
  const bestScore = best?.score ?? 0;
  const gap = best && second ? best.score - second.score : bestScore;

  let confidence: QuoteImportConfidence = 'UNMATCHED';
  let suggestedAction: QuoteImportAction = 'CREATE_EXTRA';

  if (best && bestScore >= 0.86 && gap >= 0.08 && !best.quantityConflict) {
    confidence = 'HIGH';
    suggestedAction = 'APPLY';
  } else if (best && bestScore >= 0.48) {
    confidence = 'REVIEW';
    suggestedAction = 'APPLY';
  }

  const candidateMatches = ranked
    .filter((candidate) => candidate.score >= 0.2)
    .slice(0, 3)
    .map((candidate) => ({
      budgetItemId: candidate.item.id,
      name: candidate.item.name,
      specification: candidate.item.specification,
      score: Number(candidate.score.toFixed(4)),
    }));

  return {
    ...row,
    confidence,
    quantityConflict: best?.quantityConflict ?? false,
    matchedBudgetItemId: confidence === 'UNMATCHED' ? null : (best?.item.id ?? null),
    matchedBudgetItemName: confidence === 'UNMATCHED' ? null : (best?.item.name ?? null),
    matchScore: best ? Number(best.score.toFixed(4)) : null,
    suggestedAction,
    requiresNameValidation: confidence === 'REVIEW',
    candidateMatches,
  };
}

function isStoredQuoteImportPreview(value: Prisma.JsonValue | null): value is StoredQuoteImportPreview {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.kind === 'SUPPLIER_QUOTE_IMPORT' &&
    typeof record.projectId === 'string' &&
    typeof record.slotNumber === 'number' &&
    typeof record.supplierId === 'string' &&
    Array.isArray(record.rows)
  );
}

function buildStoredQuoteImportPreview(
  projectId: string,
  slotNumber: number,
  supplierId: string,
  supplierName: string,
  extractionMode: SupplierQuoteExtractionMode,
  quoteNumber: string | null,
  quoteDate: string | null,
  detectedSupplierName: string | null,
  rows: QuoteImportPreviewRow[],
): StoredQuoteImportPreview {
  return {
    kind: 'SUPPLIER_QUOTE_IMPORT',
    projectId,
    slotNumber,
    supplierId,
    supplierName,
    extractionMode,
    quoteNumber,
    quoteDate,
    detectedSupplierName,
    importedAt: new Date().toISOString(),
    rows,
  };
}

function buildQuoteImportSummary(rows: QuoteImportPreviewRow[], hasExistingValues: boolean) {
  return {
    rowCount: rows.length,
    highConfidenceCount: rows.filter((row) => row.confidence === 'HIGH').length,
    reviewCount: rows.filter((row) => row.confidence === 'REVIEW').length,
    unmatchedCount: rows.filter((row) => row.confidence === 'UNMATCHED').length,
    extraCandidateCount: rows.filter((row) => row.suggestedAction === 'CREATE_EXTRA').length,
    hasExistingValues,
  };
}

function buildImportedQuoteItemNotes(
  fileName: string,
  preview: Pick<StoredQuoteImportPreview, 'quoteNumber' | 'quoteDate'>,
  row: Pick<QuoteImportPreviewRow, 'quantity' | 'totalValue'>,
) {
  const parts = [`Importado de ${fileName}`];

  if (preview.quoteNumber) {
    parts.push(`Orcamento ${preview.quoteNumber}`);
  }

  const quoteDateLabel = formatDateLabel(preview.quoteDate);
  if (quoteDateLabel) {
    parts.push(`Data ${quoteDateLabel}`);
  }

  if (row.quantity !== null) {
    parts.push(`Qtd. fornecedor: ${String(row.quantity).replace('.', ',')}`);
  }

  if (row.totalValue !== null) {
    parts.push(`Total PDF: ${row.totalValue.toFixed(2).replace('.', ',')}`);
  }

  return parts.join(' | ').slice(0, 500);
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
      supplierQuoteExtraItem: item.supplierQuoteExtraItem,
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
      latestImportedDocument: quote?.latestImportedDocument ? serializeProjectDocument(quote.latestImportedDocument) : null,
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

async function ensureSupplierQuoteFolders(projectId: string, supplierName: string) {
  const rootFolder = await ensureDocumentFolder(projectId, null, 'Orcamentos de fornecedores');
  const supplierFolder = await ensureDocumentFolder(projectId, rootFolder.id, supplierName);

  return {
    rootFolder,
    supplierFolder,
  };
}

function findReusableExtraBudgetItem(
  budgetItems: QuoteBudgetItem[],
  row: Pick<QuoteImportPreviewRow, 'description'>,
) {
  const normalizedRow = normalizeSupplierQuoteMatchText(row.description);
  if (!normalizedRow) {
    return null;
  }

  const candidates = budgetItems
    .filter((item) => item.supplierQuoteExtraItem)
    .map((item) => ({
      item,
      score: scoreQuoteImportMatch({ description: row.description, quantity: null }, item).score,
    }))
    .sort((left, right) => right.score - left.score);

  const best = candidates[0] ?? null;
  return best && best.score >= 0.92 ? best.item : null;
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
          latestImportedDocumentId: isChangingSupplier ? null : quote.latestImportedDocumentId,
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

  async importSupplierQuotePdf(projectId: string, slotNumber: number, file: Express.Multer.File) {
    await ensureProjectExists(projectId);

    const [quote, budgetItems] = await Promise.all([findQuoteBySlot(projectId, slotNumber), findQuoteBudgetItems(projectId)]);

    if (!quote.supplierId || !quote.supplier) {
      throw new AppError('Selecione um fornecedor antes de importar o PDF deste orcamento.', 409);
    }

    const extracted = await extractSupplierQuotePdfPreview(file.buffer, file.originalname);
    const parsedRows = extracted.rows.filter((row) => row.description.trim().length > 0 && row.unitPrice !== null);

    if (parsedRows.length === 0) {
      throw new AppError('Nao foi possivel identificar itens com preco neste PDF.', 422);
    }

    const previewRows = parsedRows.map((row) =>
      buildQuoteImportPreviewRow(
        {
          rowIndex: row.rowIndex,
          rawText: row.rawText,
          description: row.description,
          quantity: row.quantity,
          unit: row.unit,
          unitPrice: row.unitPrice ?? 0,
          totalValue: row.totalValue,
        },
        budgetItems,
      ),
    );

    const supplierName = supplierDisplayName(quote.supplier) ?? 'Fornecedor';
    const hasExistingValues = quote.items.some(hasMeaningfulQuoteItemData);
    const previewJson = buildStoredQuoteImportPreview(
      projectId,
      slotNumber,
      quote.supplierId,
      supplierName,
      extracted.extractionMode,
      extracted.quoteNumber,
      extracted.quoteDate,
      extracted.supplierNameDetected,
      previewRows,
    );

    const { supplierFolder } = await ensureSupplierQuoteFolders(projectId, supplierName);
    const document = await documentService.createProjectDocument(projectId, {
      folderId: supplierFolder.id,
      documentType: 'SUPPLIER_QUOTE_PDF',
      originalFileName: file.originalname,
      mimeType: file.mimetype || 'application/pdf',
      documentDate: extracted.quoteDate ?? undefined,
      contentText: extracted.fullText.slice(0, 50_000),
      searchText: extracted.fullText.slice(0, 200_000),
      previewJson: previewJson as Prisma.InputJsonValue,
      processingStatus: 'PROCESSED',
      reviewStatus: 'PENDING_REVIEW',
      notes: `PDF importado para o orcamento ${slotNumber}.`,
      originalFileBuffer: file.buffer,
    });

    await prisma.projectQuote.update({
      where: { id: quote.id },
      data: {
        latestImportedDocumentId: document.id,
      },
    });

    return {
      projectId,
      slotNumber,
      supplierId: quote.supplierId,
      supplierName,
      extractionMode: extracted.extractionMode,
      quoteNumber: extracted.quoteNumber,
      quoteDate: extracted.quoteDate,
      detectedSupplierName: extracted.supplierNameDetected,
      document,
      rows: previewRows,
      summary: buildQuoteImportSummary(previewRows, hasExistingValues),
    };
  }

  async applyImportedSupplierQuotePdf(
    projectId: string,
    slotNumber: number,
    documentId: string,
    input: ApplyQuoteImportInput,
  ) {
    await ensureProjectExists(projectId);

    const [quote, budgetItems, document] = await Promise.all([
      findQuoteBySlot(projectId, slotNumber),
      findQuoteBudgetItems(projectId),
      prisma.projectDocument.findFirst({
        where: {
          id: documentId,
          projectId,
          documentType: 'SUPPLIER_QUOTE_PDF',
        },
      }),
    ]);

    if (!quote.supplierId || !quote.supplier) {
      throw new AppError('Selecione um fornecedor antes de aplicar a importacao do PDF.', 409);
    }

    if (!document) {
      throw new AppError('PDF de orcamento nao encontrado neste projeto.', 404);
    }

    if (!isStoredQuoteImportPreview(document.previewJson)) {
      throw new AppError('A previa deste PDF nao esta disponivel para aplicacao.', 409);
    }

    const preview = document.previewJson;
    if (preview.projectId !== projectId || preview.slotNumber !== slotNumber) {
      throw new AppError('Este PDF nao pertence ao slot de orcamento informado.', 409);
    }

    if (preview.supplierId !== quote.supplierId) {
      throw new AppError('O fornecedor do slot mudou depois da importacao. Reimporte o PDF para continuar.', 409);
    }

    const hasSavedValues = quote.items.some(hasMeaningfulQuoteItemData);
    if (hasSavedValues && !input.confirmReplace) {
      throw new AppError(
        'Aplicar a importacao vai substituir os valores atuais deste orcamento. Confirme a operacao para continuar.',
        409,
      );
    }

    const decisionByRowIndex = new Map(input.rows.map((row) => [row.rowIndex, row]));

    await prisma.$transaction(async (tx) => {
      const workingBudgetItems = [...budgetItems];
      const quoteItemsToCreate: Array<{
        budgetItemId: string;
        unitPrice: Prisma.Decimal;
        notes: string | null;
      }> = [];
      const usedBudgetItemIds = new Set<string>();

      if (hasSavedValues) {
        await tx.projectQuoteItem.deleteMany({
          where: { projectQuoteId: quote.id },
        });
      }

      for (const previewRow of preview.rows) {
        const decision = decisionByRowIndex.get(previewRow.rowIndex);
        const action = decision?.action ?? previewRow.suggestedAction;

        if (action === 'IGNORE') {
          continue;
        }

        let targetBudgetItemId: string | null =
          action === 'APPLY' ? (decision?.matchedBudgetItemId ?? previewRow.matchedBudgetItemId) : null;

        if (action === 'CREATE_EXTRA') {
          const reusable = findReusableExtraBudgetItem(workingBudgetItems, previewRow);

          if (reusable) {
            targetBudgetItemId = reusable.id;
          } else {
            const created = await tx.budgetItem.create({
              data: {
                projectId,
                itemCategory: 'OTHER',
                name: previewRow.description,
                description: previewRow.rawText !== previewRow.description ? previewRow.rawText : null,
                unit: previewRow.unit ?? null,
                plannedQuantity: toDecimal(previewRow.quantity && previewRow.quantity > 0 ? previewRow.quantity : 1),
                hasBidReference: false,
                contextOnly: false,
                supplierQuoteExtraItem: true,
                sourceType: 'DOCUMENT_EXTRACTED',
                sourceDocumentId: document.id,
                sourceExcerpt: previewRow.rawText.slice(0, 500),
                notes: 'Nao encontrada no edital, mas presente no orcamento',
              },
              select: quoteBudgetItemSelect,
            });

            workingBudgetItems.push(created);
            targetBudgetItemId = created.id;
          }
        }

        if (!targetBudgetItemId) {
          throw new AppError(`A linha ${previewRow.rowIndex + 1} precisa de um item do projeto para ser aplicada.`, 409);
        }

        const targetBudgetItem = workingBudgetItems.find((item) => item.id === targetBudgetItemId) ?? null;
        if (!targetBudgetItem) {
          throw new AppError(`O item selecionado para a linha ${previewRow.rowIndex + 1} nao existe mais no projeto.`, 409);
        }

        if (usedBudgetItemIds.has(targetBudgetItemId)) {
          throw new AppError(
            `Mais de uma linha do PDF foi associada ao item "${targetBudgetItem.name}". Ajuste a revisao antes de aplicar.`,
            409,
          );
        }

        usedBudgetItemIds.add(targetBudgetItemId);
        quoteItemsToCreate.push({
          budgetItemId: targetBudgetItemId,
          unitPrice: toDecimal(previewRow.unitPrice) ?? new Prisma.Decimal(0),
          notes: buildImportedQuoteItemNotes(document.originalFileName, preview, previewRow),
        });
      }

      if (quoteItemsToCreate.length === 0) {
        throw new AppError('Nenhuma linha do PDF foi marcada para aplicacao.', 409);
      }

      await tx.projectQuoteItem.createMany({
        data: quoteItemsToCreate.map((row) => ({
          projectQuoteId: quote.id,
          budgetItemId: row.budgetItemId,
          unitPrice: row.unitPrice,
          notes: row.notes,
        })),
      });

      await tx.projectQuote.update({
        where: { id: quote.id },
        data: {
          latestImportedDocumentId: document.id,
        },
      });

      await tx.projectDocument.update({
        where: { id: document.id },
        data: {
          reviewStatus: 'REVIEWED',
          previewJson: {
            ...preview,
            appliedAt: new Date().toISOString(),
            decisions: input.rows,
          } as Prisma.InputJsonValue,
        },
      });
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
