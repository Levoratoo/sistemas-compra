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
  CreateQuotePurchaseInput,
  GenerateQuotePurchaseOrderInput,
  UpdateQuoteItemInput,
  UpdateQuotePurchaseInput,
  UpdateQuotePurchaseItemsInput,
  UpdateQuoteSupplierInput,
} from '../modules/quote/quote.schemas.js';
import { AppError } from '../utils/app-error.js';
import { parseOptionalDate, toIsoString } from '../utils/date.js';
import { decimalToNumber, toDecimal } from '../utils/decimal.js';
import { buildQuoteComparisonReportPdf, buildQuoteComparisonReportSearchText } from '../utils/quote-comparison-report-pdf.js';
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
const QUOTE_IMPORT_MATCH_STOP_TOKENS = new Set([
  'bombeiro',
  'civil',
  'tipo',
  'modelo',
  'identificacao',
  'algodao',
  'tatico',
  'tatica',
  'taticas',
  'taticos',
  'alto',
  'baixa',
  'baixas',
  'cano',
  'contra',
  'para',
  'uso',
  'profissional',
  'profissionais',
  'militar',
  'vermelho',
  'vermelha',
  'creme',
  'atlas',
  'dragon',
  'shirt',
  'combat',
  'pp',
  'pv',
  'p',
  'm',
  'g',
  'gg',
  'xg',
  'par',
  'pares',
  'unidade',
  'unidades',
]);

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

const quotePurchaseItemInclude = {
  budgetItem: {
    select: quoteBudgetItemSelect,
  },
} satisfies Prisma.ProjectQuotePurchaseItemInclude;

const quotePurchaseInclude = {
  items: {
    include: quotePurchaseItemInclude,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
  quotes: {
    include: quoteInclude,
    orderBy: { slotNumber: 'asc' },
  },
} satisfies Prisma.ProjectQuotePurchaseInclude;

type QuoteRecord = Prisma.ProjectQuoteGetPayload<{
  include: typeof quoteInclude;
}>;

type QuoteBudgetItem = Prisma.BudgetItemGetPayload<{
  select: typeof quoteBudgetItemSelect;
}>;

type QuotePurchaseItemRecord = Prisma.ProjectQuotePurchaseItemGetPayload<{
  include: typeof quotePurchaseItemInclude;
}>;

type QuotePurchaseRecord = Prisma.ProjectQuotePurchaseGetPayload<{
  include: typeof quotePurchaseInclude;
}>;

type QuoteProjectContext = {
  id: string;
  code: string;
  name: string;
  organizationName: string;
  city: string | null;
  state: string | null;
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

type QuotePurchaseOrderGroup = {
  supplierId: string;
  supplierName: string;
  items: QuotePurchaseOrderRow[];
  totalValue: number;
};

type QuoteComparisonAnalysisSlot = {
  slotNumber: number;
  supplierId: string | null;
  supplierName: string | null;
  totalValue: number | null;
  itemCount: number;
  filledItemCount: number;
  isComplete: boolean;
  uniqueWinCount: number;
  tieCount: number;
};

type QuoteComparisonAnalysis = {
  headline: string;
  summaryLines: string[];
  bestSlotNumbers: number[];
  bestSupplierNames: string[];
  bestTotalValue: number | null;
  secondBestTotalValue: number | null;
  savingsValue: number | null;
  savingsPercent: number | null;
  completeSlotCount: number;
  itemWinnerCounts: QuoteComparisonAnalysisSlot[];
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
  unitPrice: number | null;
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
  purchaseId: string;
  purchaseTitle: string;
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

function buildBudgetItemMatchAliases(item: QuoteBudgetItem) {
  const aliases = [item.name];
  const segments = item.name
    .split(/[—-]/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length > 1) {
    aliases.push(segments[segments.length - 1] ?? item.name);
  }

  return [...new Set(aliases)];
}

function normalizeQuoteImportToken(token: string) {
  let normalized = normalizeSupplierQuoteMatchText(token);
  if (!normalized) {
    return '';
  }

  if (normalized.endsWith('oes')) {
    normalized = `${normalized.slice(0, -3)}ao`;
  } else if (normalized.endsWith('ais')) {
    normalized = `${normalized.slice(0, -3)}al`;
  } else if (normalized.endsWith('eis')) {
    normalized = `${normalized.slice(0, -3)}el`;
  } else if (normalized.endsWith('s') && normalized.length > 4) {
    normalized = normalized.slice(0, -1);
  }

  if (normalized.startsWith('gandol')) return 'gandol';
  if (normalized.startsWith('camiset')) return 'camiseta';
  if (normalized.startsWith('calca')) return 'calca';
  if (normalized.startsWith('bota')) return 'bota';
  if (normalized.startsWith('cinto')) return 'cinto';
  if (normalized.startsWith('meia')) return 'meia';
  if (normalized.startsWith('bone')) return 'bone';
  if (normalized.startsWith('oculo')) return 'oculos';
  if (normalized.startsWith('mascar')) return 'mascara';
  if (normalized.startsWith('luva')) return 'luva';
  if (normalized.startsWith('joelhe')) return 'joelheira';
  if (normalized.startsWith('cotovel')) return 'cotoveleira';
  if (normalized.startsWith('protet')) return 'protetor';
  if (normalized.startsWith('audit')) return 'auditivo';
  if (normalized.startsWith('lantern')) return 'lanterna';
  if (normalized.startsWith('bateri')) return 'bateria';
  if (normalized.startsWith('apito')) return 'apito';
  if (normalized.startsWith('capacet')) return 'capacete';
  if (normalized.startsWith('pranch')) return 'prancha';

  return normalized;
}

function tokenizeQuoteImportCoreText(value: string) {
  return tokenizeSupplierQuoteMatchText(value)
    .map((token) => normalizeQuoteImportToken(token))
    .filter((token) => token.length > 1 && !QUOTE_IMPORT_MATCH_STOP_TOKENS.has(token));
}

function calculateTokenCoverage(left: string[], right: string[]) {
  if (left.length === 0 || right.length === 0) {
    return {
      sharedCount: 0,
      leftCoverage: 0,
      rightCoverage: 0,
    };
  }

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const sharedCount = [...leftSet].filter((token) => rightSet.has(token)).length;

  return {
    sharedCount,
    leftCoverage: sharedCount / leftSet.size,
    rightCoverage: sharedCount / rightSet.size,
  };
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
  const itemMatchText = buildBudgetItemMatchText(item);
  const itemNormalized = normalizeSupplierQuoteMatchText(itemMatchText);
  const rowTokens = tokenizeSupplierQuoteMatchText(row.description);
  const itemTokens = tokenizeSupplierQuoteMatchText(itemMatchText);
  const overlapScore = calculateTokenOverlapScore(rowTokens, itemTokens);
  const quantityConflict = quantityConflictWithBudgetItem(row.quantity, decimalToNumber(item.plannedQuantity));
  const aliasSignals = buildBudgetItemMatchAliases(item).map((alias) => {
    const aliasNormalized = normalizeSupplierQuoteMatchText(alias);
    const aliasTokens = tokenizeSupplierQuoteMatchText(alias);
    const aliasCoreTokens = tokenizeQuoteImportCoreText(alias);
    const coreCoverage = calculateTokenCoverage(tokenizeQuoteImportCoreText(row.description), aliasCoreTokens);

    return {
      aliasNormalized,
      overlapScore: calculateTokenOverlapScore(rowTokens, aliasTokens),
      coreCoverage,
    };
  });
  const bestAliasOverlap = Math.max(...aliasSignals.map((signal) => signal.overlapScore), 0);
  const bestCoreSharedCount = Math.max(...aliasSignals.map((signal) => signal.coreCoverage.sharedCount), 0);
  const bestCoreLeftCoverage = Math.max(...aliasSignals.map((signal) => signal.coreCoverage.leftCoverage), 0);
  const bestCoreRightCoverage = Math.max(...aliasSignals.map((signal) => signal.coreCoverage.rightCoverage), 0);

  let score = Math.max(overlapScore, bestAliasOverlap);

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

  for (const signal of aliasSignals) {
    if (!signal.aliasNormalized) {
      continue;
    }

    if (rowNormalized === signal.aliasNormalized) {
      score = 1;
      break;
    }

    if (
      rowNormalized.length >= 4 &&
      signal.aliasNormalized.length >= 4 &&
      (rowNormalized.includes(signal.aliasNormalized) || signal.aliasNormalized.includes(rowNormalized))
    ) {
      score = Math.max(score, 0.93);
    }
  }

  if (bestCoreSharedCount >= 2 && bestCoreLeftCoverage >= 0.4) {
    score = Math.max(score, 0.68);
  } else if (bestCoreRightCoverage >= 1 && bestCoreSharedCount >= 1) {
    score = Math.max(score, 0.58);
  } else if (bestCoreLeftCoverage >= 0.5) {
    score = Math.max(score, 0.52);
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
    typeof record.purchaseId === 'string' &&
    typeof record.slotNumber === 'number' &&
    typeof record.supplierId === 'string' &&
    Array.isArray(record.rows)
  );
}

function buildStoredQuoteImportPreview(
  projectId: string,
  purchaseId: string,
  purchaseTitle: string,
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
    purchaseId,
    purchaseTitle,
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

function findReusableExtraBudgetItem(
  projectBudgetItems: QuoteBudgetItem[],
  row: Pick<QuoteImportPreviewRow, 'description'>,
) {
  const normalizedRow = normalizeSupplierQuoteMatchText(row.description);
  if (!normalizedRow) {
    return null;
  }

  const candidates = projectBudgetItems
    .filter((item) => item.supplierQuoteExtraItem)
    .map((item) => ({
      item,
      score: scoreQuoteImportMatch({ description: row.description, quantity: null }, item).score,
    }))
    .sort((left, right) => right.score - left.score);

  const best = candidates[0] ?? null;
  return best && best.score >= 0.92 ? best.item : null;
}

function buildQuotePurchaseState(projectId: string, purchase: QuotePurchaseRecord) {
  const quoteBySlot = new Map(purchase.quotes.map((quote) => [quote.slotNumber, quote]));

  const rows = purchase.items.map((purchaseItem) => {
    const item = purchaseItem.budgetItem;
    const quantity = decimalToNumber(purchaseItem.quantity) ?? decimalToNumber(item.plannedQuantity);
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

  const comparisonAnalysis = buildQuoteComparisonAnalysis(slots, rows, overallWinner);

  return {
    id: purchase.id,
    projectId,
    title: purchase.title,
    notes: purchase.notes ?? null,
    createdAt: toIsoString(purchase.createdAt),
    updatedAt: toIsoString(purchase.updatedAt),
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
      analysis: comparisonAnalysis,
    },
  };
}

function buildProjectQuotesState(projectId: string, purchases: QuotePurchaseRecord[]) {
  return {
    projectId,
    purchases: purchases.map((purchase) => buildQuotePurchaseState(projectId, purchase)),
  };
}

function formatPercent(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function buildQuoteComparisonAnalysis(
  slots: ReturnType<typeof buildQuotePurchaseState>['slots'],
  rows: ReturnType<typeof buildQuotePurchaseState>['rows'],
  overallWinner: {
    status: QuoteWinnerStatus;
    slotNumbers: number[];
    totalValue: number | null;
  },
): QuoteComparisonAnalysis {
  const itemWinnerCounts: QuoteComparisonAnalysisSlot[] = slots.map((slot) => ({
    slotNumber: slot.slotNumber,
    supplierId: slot.supplierId,
    supplierName: slot.supplier?.tradeName || slot.supplier?.legalName || null,
    totalValue: slot.totalValue,
    itemCount: slot.itemCount,
    filledItemCount: slot.filledItemCount,
    isComplete: slot.isComplete,
    uniqueWinCount: rows.filter((row) => row.winner.status === 'UNIQUE' && row.winner.slotNumbers[0] === slot.slotNumber).length,
    tieCount: rows.filter((row) => row.winner.status === 'TIE' && row.winner.slotNumbers.includes(slot.slotNumber)).length,
  }));

  const completeSlots = itemWinnerCounts
    .filter((slot) => slot.isComplete && slot.totalValue !== null)
    .sort((left, right) => (left.totalValue ?? Number.POSITIVE_INFINITY) - (right.totalValue ?? Number.POSITIVE_INFINITY));

  const bestTotalValue = overallWinner.totalValue ?? completeSlots[0]?.totalValue ?? null;
  const secondBest =
    bestTotalValue === null
      ? null
      : completeSlots.find((slot) => slot.totalValue !== null && !sameMoney(slot.totalValue, bestTotalValue)) ?? null;
  const savingsValue =
    bestTotalValue !== null && secondBest !== null && secondBest.totalValue !== null
      ? Number((secondBest.totalValue - bestTotalValue).toFixed(2))
      : null;
  const savingsPercent =
    savingsValue !== null && secondBest !== null && secondBest.totalValue !== null
      ? Number(((savingsValue / secondBest.totalValue) * 100).toFixed(1))
      : null;
  const bestSlots =
    overallWinner.status === 'NONE'
      ? []
      : itemWinnerCounts.filter((slot) => overallWinner.slotNumbers.includes(slot.slotNumber));

  const bestSupplierNames = bestSlots.map((slot) => slot.supplierName || `Orcamento ${slot.slotNumber}`);
  const summaryLines: string[] = [];
  let headline = 'Ainda nao existe um melhor orcamento geral definido.';

  if (overallWinner.status === 'UNIQUE' && bestSlots[0] && bestTotalValue !== null) {
    headline = `${bestSupplierNames[0]} (orcamento ${bestSlots[0].slotNumber}) apresenta o menor total geral: ${bestTotalValue.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })}.`;

    if (savingsValue !== null && savingsPercent !== null) {
      const secondBestLabel = secondBest?.supplierName || (secondBest ? `Orcamento ${secondBest.slotNumber}` : 'o segundo colocado');
      summaryLines.push(
        `A economia frente ao segundo melhor orcamento (${secondBestLabel}) e de ${savingsValue.toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        })} (${formatPercent(savingsPercent)}%).`,
      );
    }
  } else if (overallWinner.status === 'TIE' && bestTotalValue !== null) {
    headline = `Existe empate no melhor total geral entre ${bestSlots
      .map((slot) => `${slot.supplierName || `Orcamento ${slot.slotNumber}`} (orcamento ${slot.slotNumber})`)
      .join(' e ')}: ${bestTotalValue.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })}.`;
  } else if (completeSlots.length === 0) {
    headline = 'Nenhum dos 3 orcamentos esta completo o suficiente para definir o melhor total geral.';
  }

  summaryLines.push(
    `${rows.filter((row) => row.winner.status === 'UNIQUE').length} item(ns) ja possuem vencedor unico, ${rows.filter((row) => row.winner.status === 'TIE').length} estao empatados e ${rows.filter((row) => row.winner.status === 'NONE').length} seguem pendentes.`,
  );

  const slotLead = [...itemWinnerCounts].sort(
    (left, right) => right.uniqueWinCount - left.uniqueWinCount || left.slotNumber - right.slotNumber,
  )[0];

  if (slotLead && slotLead.uniqueWinCount > 0) {
    summaryLines.push(
      `${slotLead.supplierName || `Orcamento ${slotLead.slotNumber}`} lidera nas vitorias por item com ${slotLead.uniqueWinCount} item(ns) de menor valor.`,
    );
  }

  if (rows.some((row) => row.winner.status === 'NONE')) {
    summaryLines.push('Ainda existem itens sem comparacao fechada. O melhor total geral pode mudar quando os valores pendentes forem preenchidos.');
  }

  return {
    headline,
    summaryLines,
    bestSlotNumbers: overallWinner.slotNumbers,
    bestSupplierNames,
    bestTotalValue,
    secondBestTotalValue: secondBest?.totalValue ?? null,
    savingsValue,
    savingsPercent,
    completeSlotCount: completeSlots.length,
    itemWinnerCounts,
  };
}

function buildWinningPurchaseOrderGroups(state: ReturnType<typeof buildQuotePurchaseState>): QuotePurchaseOrderGroup[] {
  const slotMap = new Map<number, (typeof state.slots)[number]>(state.slots.map((slot) => [slot.slotNumber, slot]));
  const groupMap = new Map<string, QuotePurchaseOrderGroup>();

  for (const row of state.rows) {
    if (row.winner.status !== 'UNIQUE') {
      continue;
    }

    const winnerSlotNumber = row.winner.slotNumbers[0];
    const slot = winnerSlotNumber ? slotMap.get(winnerSlotNumber) : null;
    const supplierId = slot?.supplierId ?? null;
    const supplierName = slot?.supplier?.tradeName || slot?.supplier?.legalName || null;
    const value = row.values.find((entry) => entry.slotNumber === winnerSlotNumber) ?? null;

    if (!supplierId || !supplierName || !value || value.unitPrice === null || value.totalValue === null || row.quantity === null) {
      continue;
    }

    const existingGroup = groupMap.get(supplierId);
    const orderRow: QuotePurchaseOrderRow = {
      budgetItemId: row.budgetItemId,
      description: row.description,
      quantity: row.quantity,
      unitPrice: value.unitPrice,
      totalValue: value.totalValue,
      notes: value.notes ?? null,
    };

    if (existingGroup) {
      existingGroup.items.push(orderRow);
      existingGroup.totalValue += orderRow.totalValue;
      continue;
    }

    groupMap.set(supplierId, {
      supplierId,
      supplierName,
      items: [orderRow],
      totalValue: orderRow.totalValue,
    });
  }

  return [...groupMap.values()];
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
    },
  });

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  return project;
}

async function findProjectQuoteBudgetItems(projectId: string) {
  return prisma.budgetItem.findMany({
    where: {
      projectId,
      contextOnly: false,
    },
    select: quoteBudgetItemSelect,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
}

async function ensureQuoteSlotsForPurchase(projectId: string, purchaseId: string) {
  await prisma.projectQuote.createMany({
    data: QUOTE_SLOT_NUMBERS.map((slotNumber) => ({
      projectId,
      projectQuotePurchaseId: purchaseId,
      slotNumber,
    })),
    skipDuplicates: true,
  });
}

async function ensureLegacyQuotePurchases(projectId: string) {
  const legacyQuotes = await prisma.projectQuote.findMany({
    where: {
      projectId,
      projectQuotePurchaseId: null,
    },
    select: { id: true },
  });

  if (legacyQuotes.length === 0) {
    return;
  }

  const purchaseCount = await prisma.projectQuotePurchase.count({
    where: { projectId },
  });

  const budgetItems = await prisma.budgetItem.findMany({
    where: {
      projectId,
      contextOnly: false,
    },
    select: {
      id: true,
      plannedQuantity: true,
    },
  });

  await prisma.$transaction(async (tx) => {
    const createdPurchase = await tx.projectQuotePurchase.create({
      data: {
        projectId,
        title: purchaseCount === 0 ? 'Compra inicial' : `Compra migrada ${purchaseCount + 1}`,
      },
    });

    if (budgetItems.length > 0) {
      await tx.projectQuotePurchaseItem.createMany({
        data: budgetItems.map((item) => ({
          projectQuotePurchaseId: createdPurchase.id,
          budgetItemId: item.id,
          quantity: item.plannedQuantity ?? null,
        })),
        skipDuplicates: true,
      });
    }

    await tx.projectQuote.updateMany({
      where: {
        projectId,
        projectQuotePurchaseId: null,
      },
      data: {
        projectQuotePurchaseId: createdPurchase.id,
      },
    });
  });
}

async function findQuotePurchases(projectId: string) {
  return prisma.projectQuotePurchase.findMany({
    where: { projectId },
    include: quotePurchaseInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
}

async function buildProjectQuotesModuleState(projectId: string) {
  await ensureLegacyQuotePurchases(projectId);

  const purchases = await prisma.projectQuotePurchase.findMany({
    where: { projectId },
    select: { id: true },
  });

  await Promise.all(purchases.map((purchase) => ensureQuoteSlotsForPurchase(projectId, purchase.id)));

  const hydratedPurchases = await findQuotePurchases(projectId);
  return buildProjectQuotesState(projectId, hydratedPurchases);
}

async function findQuotePurchaseSummary(projectId: string, purchaseId: string) {
  const purchase = await prisma.projectQuotePurchase.findFirst({
    where: {
      id: purchaseId,
      projectId,
    },
    select: {
      id: true,
      projectId: true,
      title: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!purchase) {
    throw new AppError('Quote purchase not found', 404);
  }

  return purchase;
}

async function findQuoteBySlot(projectId: string, purchaseId: string, slotNumber: number) {
  await ensureQuoteSlotsForPurchase(projectId, purchaseId);

  const quote = await prisma.projectQuote.findUnique({
    where: {
      projectQuotePurchaseId_slotNumber: {
        projectQuotePurchaseId: purchaseId,
        slotNumber,
      },
    },
    include: quoteInclude,
  });

  if (!quote || quote.projectId !== projectId) {
    throw new AppError('Quote slot not found', 404);
  }

  return quote;
}

async function findQuotePurchaseItem(projectId: string, purchaseId: string, budgetItemId: string) {
  const item = await prisma.projectQuotePurchaseItem.findFirst({
    where: {
      projectQuotePurchaseId: purchaseId,
      budgetItemId,
      budgetItem: {
        projectId,
        contextOnly: false,
      },
    },
    include: quotePurchaseItemInclude,
  });

  if (!item) {
    throw new AppError('Budget item not found in this quote purchase', 404);
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

async function ensureSupplierQuoteFolders(projectId: string, purchaseTitle: string, supplierName: string) {
  const rootFolder = await ensureDocumentFolder(projectId, null, 'Orcamentos de fornecedores');
  const purchaseFolder = await ensureDocumentFolder(projectId, rootFolder.id, purchaseTitle);
  const supplierFolder = await ensureDocumentFolder(projectId, purchaseFolder.id, supplierName);

  return {
    rootFolder,
    purchaseFolder,
    supplierFolder,
  };
}

async function ensureQuoteComparisonReportFolders(projectId: string, purchaseTitle: string) {
  const rootFolder = await ensureDocumentFolder(projectId, null, 'Relatorios de orcamento');
  const purchaseFolder = await ensureDocumentFolder(projectId, rootFolder.id, purchaseTitle);

  return {
    rootFolder,
    purchaseFolder,
  };
}

async function ensureQuotePurchaseItemLink(
  tx: Prisma.TransactionClient,
  purchaseId: string,
  budgetItemId: string,
  quantity: Prisma.Decimal | null,
) {
  await tx.projectQuotePurchaseItem.upsert({
    where: {
      projectQuotePurchaseId_budgetItemId: {
        projectQuotePurchaseId: purchaseId,
        budgetItemId,
      },
    },
    update: {},
    create: {
      projectQuotePurchaseId: purchaseId,
      budgetItemId,
      quantity,
    },
  });
}

class QuoteService {
  async listProjectQuotes(projectId: string) {
    await ensureProjectExists(projectId);
    return buildProjectQuotesModuleState(projectId);
  }

  async createQuotePurchase(projectId: string, input: CreateQuotePurchaseInput) {
    await ensureProjectExists(projectId);

    const purchase = await prisma.projectQuotePurchase.create({
      data: {
        projectId,
        title: input.title.trim(),
        notes: normalizeOptionalText(input.notes),
      },
    });

    await ensureQuoteSlotsForPurchase(projectId, purchase.id);
    return buildProjectQuotesModuleState(projectId);
  }

  async updateQuotePurchase(projectId: string, purchaseId: string, input: UpdateQuotePurchaseInput) {
    await ensureProjectExists(projectId);
    await findQuotePurchaseSummary(projectId, purchaseId);

    await prisma.projectQuotePurchase.update({
      where: { id: purchaseId },
      data: {
        title: input.title.trim(),
        notes: normalizeOptionalText(input.notes),
      },
    });

    return buildProjectQuotesModuleState(projectId);
  }

  async deleteQuotePurchase(projectId: string, purchaseId: string) {
    await ensureProjectExists(projectId);
    await findQuotePurchaseSummary(projectId, purchaseId);

    await prisma.projectQuotePurchase.delete({
      where: { id: purchaseId },
    });

    return buildProjectQuotesModuleState(projectId);
  }

  async addQuotePurchaseItems(projectId: string, purchaseId: string, input: UpdateQuotePurchaseItemsInput) {
    await ensureProjectExists(projectId);
    await findQuotePurchaseSummary(projectId, purchaseId);

    const budgetItems = await prisma.budgetItem.findMany({
      where: {
        id: { in: input.budgetItemIds },
        projectId,
        contextOnly: false,
      },
      select: {
        id: true,
        plannedQuantity: true,
      },
    });

    if (budgetItems.length !== new Set(input.budgetItemIds).size) {
      throw new AppError('Um ou mais itens nao pertencem a este projeto.', 409);
    }

    await prisma.projectQuotePurchaseItem.createMany({
      data: budgetItems.map((item) => ({
        projectQuotePurchaseId: purchaseId,
        budgetItemId: item.id,
        quantity: item.plannedQuantity ?? null,
      })),
      skipDuplicates: true,
    });

    return buildProjectQuotesModuleState(projectId);
  }

  async removeQuotePurchaseItem(projectId: string, purchaseId: string, budgetItemId: string) {
    await ensureProjectExists(projectId);
    await findQuotePurchaseItem(projectId, purchaseId, budgetItemId);

    const quoteIds = await prisma.projectQuote.findMany({
      where: { projectQuotePurchaseId: purchaseId },
      select: { id: true },
    });

    await prisma.$transaction(async (tx) => {
      if (quoteIds.length > 0) {
        await tx.projectQuoteItem.deleteMany({
          where: {
            budgetItemId,
            projectQuoteId: {
              in: quoteIds.map((quote) => quote.id),
            },
          },
        });
      }

      await tx.projectQuotePurchaseItem.delete({
        where: {
          projectQuotePurchaseId_budgetItemId: {
            projectQuotePurchaseId: purchaseId,
            budgetItemId,
          },
        },
      });
    });

    return buildProjectQuotesModuleState(projectId);
  }

  async updateQuoteSupplier(
    projectId: string,
    purchaseId: string,
    slotNumber: number,
    input: UpdateQuoteSupplierInput,
  ) {
    await ensureProjectExists(projectId);
    await findQuotePurchaseSummary(projectId, purchaseId);

    if (input.supplierId) {
      const supplier = await supplierRepository.findById(input.supplierId);
      if (!supplier) {
        throw new AppError('Supplier not found', 404);
      }
    }

    const quote = await findQuoteBySlot(projectId, purchaseId, slotNumber);
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

    return buildProjectQuotesModuleState(projectId);
  }

  async updateQuoteItem(
    projectId: string,
    purchaseId: string,
    slotNumber: number,
    budgetItemId: string,
    input: UpdateQuoteItemInput,
  ) {
    await ensureProjectExists(projectId);

    const [quote] = await Promise.all([
      findQuoteBySlot(projectId, purchaseId, slotNumber),
      findQuotePurchaseItem(projectId, purchaseId, budgetItemId),
    ]);

    if (!quote.supplierId) {
      throw new AppError('Selecione um fornecedor para este orcamento antes de preencher valores.', 409);
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
        unitPrice: toDecimal(input.unitPrice) ?? null,
        notes: normalizeQuoteNotes(input.notes),
      },
      update: {
        unitPrice: input.unitPrice !== undefined ? toDecimal(input.unitPrice) ?? null : undefined,
        notes: input.notes !== undefined ? normalizeQuoteNotes(input.notes) : undefined,
      },
    });

    return buildProjectQuotesModuleState(projectId);
  }

  async importSupplierQuotePdf(
    projectId: string,
    purchaseId: string,
    slotNumber: number,
    file: Express.Multer.File,
  ) {
    await ensureProjectExists(projectId);

    const [purchase, quote, purchaseBudgetItems] = await Promise.all([
      findQuotePurchaseSummary(projectId, purchaseId),
      findQuoteBySlot(projectId, purchaseId, slotNumber),
      prisma.projectQuotePurchaseItem.findMany({
        where: { projectQuotePurchaseId: purchaseId },
        include: quotePurchaseItemInclude,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    ]);

    if (!quote.supplierId || !quote.supplier) {
      throw new AppError('Selecione um fornecedor antes de importar o PDF deste orcamento.', 409);
    }

    const supplierName = supplierDisplayName(quote.supplier) ?? 'Fornecedor';
    const { supplierFolder } = await ensureSupplierQuoteFolders(projectId, purchase.title, supplierName);
    const extracted = await extractSupplierQuotePdfPreview(file.buffer, file.originalname);
    const budgetItems = purchaseBudgetItems.map((purchaseItem) => purchaseItem.budgetItem);
    const rows = extracted.rows.map((row) => buildQuoteImportPreviewRow(row, budgetItems));
    const hasExistingValues = quote.items.some(hasMeaningfulQuoteItemData);

    const document = await documentService.createProjectDocument(projectId, {
      folderId: supplierFolder.id,
      documentType: 'SUPPLIER_QUOTE_PDF',
      originalFileName: file.originalname,
      mimeType: file.mimetype || 'application/pdf',
      documentDate: extracted.quoteDate ? toSaoPauloNoonDate(extracted.quoteDate).toISOString() : undefined,
      processingStatus: 'PROCESSED',
      reviewStatus: 'REVIEWED',
      notes: `PDF importado para a compra ${purchase.title}, orcamento ${slotNumber}.`,
      searchText: extracted.fullText,
      contentText: extracted.fullText,
      previewJson: buildStoredQuoteImportPreview(
        projectId,
        purchaseId,
        purchase.title,
        slotNumber,
        quote.supplierId,
        supplierName,
        extracted.extractionMode,
        extracted.quoteNumber,
        extracted.quoteDate,
        extracted.supplierNameDetected,
        rows,
      ),
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
      purchaseId,
      slotNumber,
      supplierId: quote.supplierId,
      supplierName,
      extractionMode: extracted.extractionMode,
      quoteNumber: extracted.quoteNumber,
      quoteDate: extracted.quoteDate,
      detectedSupplierName: extracted.supplierNameDetected,
      document,
      rows,
      summary: buildQuoteImportSummary(rows, hasExistingValues),
    };
  }

  async applyImportedSupplierQuotePdf(
    projectId: string,
    purchaseId: string,
    slotNumber: number,
    documentId: string,
    input: ApplyQuoteImportInput,
  ) {
    await ensureProjectExists(projectId);

    const [quote, document, projectBudgetItems] = await Promise.all([
      findQuoteBySlot(projectId, purchaseId, slotNumber),
      prisma.projectDocument.findFirst({
        where: {
          id: documentId,
          projectId,
        },
      }),
      findProjectQuoteBudgetItems(projectId),
    ]);

    if (!quote.supplierId) {
      throw new AppError('Selecione um fornecedor antes de aplicar a importacao do PDF.', 409);
    }

    if (!document) {
      throw new AppError('PDF de orcamento nao encontrado neste projeto.', 404);
    }

    if (!isStoredQuoteImportPreview(document.previewJson)) {
      throw new AppError('O documento selecionado nao possui uma importacao valida para aplicar.', 409);
    }

    const preview = document.previewJson;
    if (preview.projectId !== projectId || preview.purchaseId !== purchaseId || preview.slotNumber !== slotNumber) {
      throw new AppError('Este PDF nao pertence a compra e ao slot de orcamento informados.', 409);
    }

    if (preview.supplierId !== quote.supplierId) {
      throw new AppError('O fornecedor do slot mudou depois da importacao. Reimporte o PDF para continuar.', 409);
    }

    const hasExistingValues = quote.items.some(hasMeaningfulQuoteItemData);
    if (hasExistingValues && !input.confirmReplace) {
      throw new AppError(
        'Aplicar a importacao vai substituir os valores atuais deste orcamento. Confirme a operacao para continuar.',
        409,
      );
    }

    const decisions = new Map(input.rows.map((row) => [row.rowIndex, row]));

    await prisma.$transaction(async (tx) => {
      if (hasExistingValues) {
        await tx.projectQuoteItem.deleteMany({
          where: { projectQuoteId: quote.id },
        });
      }

      const quoteItemsToCreate: Array<{
        budgetItemId: string;
        unitPrice: Prisma.Decimal | null;
        notes: string | null;
      }> = [];

      for (const row of preview.rows) {
        const decision = decisions.get(row.rowIndex);
        if (!decision || decision.action === 'IGNORE') {
          continue;
        }

        let budgetItemId = decision.matchedBudgetItemId ?? row.matchedBudgetItemId;

        if (decision.action === 'CREATE_EXTRA') {
          const reusableExtra = findReusableExtraBudgetItem(projectBudgetItems, row);

          if (reusableExtra) {
            budgetItemId = reusableExtra.id;
            await ensureQuotePurchaseItemLink(
              tx,
              purchaseId,
              reusableExtra.id,
              reusableExtra.plannedQuantity ?? null,
            );
          } else {
            const createdBudgetItem = await tx.budgetItem.create({
              data: {
                projectId,
                itemCategory: 'OTHER',
                name: row.description.trim() || 'Item extra do fornecedor',
                specification: row.rawText.trim() || null,
                unit: row.unit?.trim() || null,
                plannedQuantity: toDecimal(row.quantity) ?? null,
                supplierQuoteExtraItem: true,
                hasBidReference: false,
                sourceType: 'MANUAL',
                contextOnly: false,
                notes: 'Nao encontrada no edital, mas presente no orcamento',
              },
              select: quoteBudgetItemSelect,
            });

            budgetItemId = createdBudgetItem.id;
            await ensureQuotePurchaseItemLink(
              tx,
              purchaseId,
              createdBudgetItem.id,
              createdBudgetItem.plannedQuantity ?? null,
            );
          }
        } else if (budgetItemId) {
          const existingBudgetItem = await tx.budgetItem.findFirst({
            where: {
              id: budgetItemId,
              projectId,
              contextOnly: false,
            },
            select: {
              id: true,
              plannedQuantity: true,
            },
          });

          if (!existingBudgetItem) {
            throw new AppError('Item do projeto nao encontrado para aplicar a importacao.', 404);
          }

          await ensureQuotePurchaseItemLink(
            tx,
            purchaseId,
            existingBudgetItem.id,
            existingBudgetItem.plannedQuantity ?? null,
          );
        }

        if (!budgetItemId) {
          continue;
        }

        quoteItemsToCreate.push({
          budgetItemId,
          unitPrice: toDecimal(row.unitPrice) ?? null,
          notes: buildImportedQuoteItemNotes(document.originalFileName, preview, row),
        });
      }

      if (quoteItemsToCreate.length === 0) {
        throw new AppError('Nenhuma linha elegivel foi selecionada para aplicar.', 409);
      }

      await tx.projectQuoteItem.createMany({
        data: quoteItemsToCreate.map((row) => ({
          projectQuoteId: quote.id,
          budgetItemId: row.budgetItemId,
          unitPrice: row.unitPrice,
          notes: row.notes,
        })),
        skipDuplicates: true,
      });
    });

    return buildProjectQuotesModuleState(projectId);
  }

  async applyQuoteWinner(projectId: string, purchaseId: string, input: ApplyQuoteWinnerInput) {
    const state = await buildProjectQuotesModuleState(projectId);
    const purchaseState = state.purchases.find((purchase) => purchase.id === purchaseId) ?? null;

    if (!purchaseState) {
      throw new AppError('Quote purchase not found', 404);
    }

    const slotMap = new Map<number, (typeof purchaseState.slots)[number]>(
      purchaseState.slots.map((slot) => [slot.slotNumber, slot]),
    );

    const rowsToApply =
      input.mode === 'OVERALL'
        ? (() => {
            if (purchaseState.comparison.overallWinner.status !== 'UNIQUE') {
              throw new AppError('Nao existe vencedor geral unico para aplicar.', 409);
            }

            const winnerSlot = purchaseState.comparison.overallWinner.slotNumbers[0];
            const slot = winnerSlot ? slotMap.get(winnerSlot) : null;
            if (!slot?.supplier?.legalName) {
              throw new AppError('O orcamento vencedor geral nao possui fornecedor valido.', 409);
            }

            const approvedSupplierName = slot.supplier.legalName;

            return purchaseState.rows
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
        : purchaseState.rows
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
      skippedItems: Math.max(0, purchaseState.rows.length - rowsToApply.length),
    };
  }

  async generateComparisonReport(projectId: string, purchaseId: string) {
    const [project, state] = await Promise.all([
      findQuoteProjectContext(projectId),
      buildProjectQuotesModuleState(projectId),
    ]);

    const purchaseState = state.purchases.find((purchase) => purchase.id === purchaseId) ?? null;
    if (!purchaseState) {
      throw new AppError('Quote purchase not found', 404);
    }

    if (purchaseState.rows.length === 0) {
      throw new AppError('Esta compra ainda nao possui itens para gerar o relatorio do mapa.', 409);
    }

    const saoPauloNow = getSaoPauloNowParts();
    const issuedAt = toSaoPauloNoonDate(saoPauloNow.isoDate);
    const { purchaseFolder } = await ensureQuoteComparisonReportFolders(projectId, purchaseState.title);
    const projectSegment = sanitizeDocumentSegment((project.code?.trim() || project.name?.trim() || 'PROJETO').toUpperCase());
    const purchaseSegment = sanitizeDocumentSegment(purchaseState.title.toUpperCase());
    const fileName = `${projectSegment}_${purchaseSegment}_relatorio_mapa_${saoPauloNow.isoDate}.pdf`;

    const pdfInput = {
      issuerName: project.organizationName,
      issuerCity: project.city,
      issuerState: project.state,
      projectCode: project.code,
      projectName: project.name,
      purchaseTitle: purchaseState.title,
      purchaseNotes: purchaseState.notes,
      issuedAtLabel: saoPauloNow.label,
      analysis: purchaseState.comparison.analysis,
      slotTotals: purchaseState.comparison.slotTotals,
      rows: purchaseState.rows.map((row) => ({
        description: row.description,
        quantity: row.quantity,
        slotTotals: QUOTE_SLOT_NUMBERS.map((slotNumber) => ({
          slotNumber,
          totalValue: row.values.find((entry) => entry.slotNumber === slotNumber)?.totalValue ?? null,
        })),
        winnerStatus: row.winner.status,
        winnerSlotNumbers: [...row.winner.slotNumbers],
        winnerLabel:
          row.winner.status === 'UNIQUE'
            ? `Orcamento ${row.winner.slotNumbers[0]}`
            : row.winner.status === 'TIE'
              ? `Empate ${row.winner.slotNumbers.map((slotNumber) => `O${slotNumber}`).join('/')}`
              : 'Pendente',
      })),
    } satisfies Parameters<typeof buildQuoteComparisonReportPdf>[0];

    const pdfBytes = await buildQuoteComparisonReportPdf(pdfInput);
    const searchText = buildQuoteComparisonReportSearchText(pdfInput);
    const document = await documentService.createProjectDocument(projectId, {
      folderId: purchaseFolder.id,
      documentType: 'OTHER_ATTACHMENT',
      originalFileName: fileName,
      mimeType: 'application/pdf',
      documentDate: issuedAt.toISOString(),
      contentText: searchText,
      searchText,
      notes: `Relatorio gerado do mapa comparativo da compra ${purchaseState.title}.`,
      processingStatus: 'PROCESSED',
      reviewStatus: 'REVIEWED',
      previewJson: {
        kind: 'QUOTE_COMPARISON_REPORT',
        purchaseId,
        purchaseTitle: purchaseState.title,
        analysis: purchaseState.comparison.analysis,
      },
      originalFileBuffer: Buffer.from(pdfBytes),
    });

    return {
      purchaseId,
      purchaseTitle: purchaseState.title,
      documentId: document.id,
      documentFileName: document.originalFileName,
      folderPathLabel: document.folderPathLabel ?? null,
      analysis: purchaseState.comparison.analysis,
    };
  }

  async generatePurchaseOrderDocuments(
    projectId: string,
    purchaseId: string,
    input: GenerateQuotePurchaseOrderInput,
  ) {
    const [project, state] = await Promise.all([
      findQuoteProjectContext(projectId),
      buildProjectQuotesModuleState(projectId),
    ]);

    const purchaseState = state.purchases.find((purchase) => purchase.id === purchaseId) ?? null;
    if (!purchaseState) {
      throw new AppError('Quote purchase not found', 404);
    }

    const groups = buildWinningPurchaseOrderGroups(purchaseState);
    if (groups.length === 0) {
      throw new AppError(
        'Nao existem itens com vencedor unico para gerar pedidos. Resolva os itens pendentes ou empatados.',
        409,
      );
    }

    const saoPauloNow = getSaoPauloNowParts();
    const issuedAt = toSaoPauloNoonDate(saoPauloNow.isoDate);
    const expectedDeliveryDate = parseDateInputInSaoPaulo(input.expectedDeliveryDate ?? null);
    const { monthFolder } = await ensurePurchaseOrderFolders(projectId, saoPauloNow.monthFolderName);
    const projectFileSegment = sanitizeDocumentSegment(
      (project.code?.trim() || project.name?.trim() || 'PROJETO').toUpperCase(),
    );
    const purchaseSegment = sanitizeDocumentSegment(purchaseState.title.toUpperCase());
    const glpiSegment = sanitizeDocumentSegment(input.glpiNumber);

    const generatedOrders = [];

    for (const group of groups) {
      const existingOrder = await purchaseRepository.findOrderBySourceQuotePurchaseAndSupplier(
        purchaseId,
        group.supplierId,
        input.glpiNumber,
      );

      const order =
        existingOrder === null
          ? await purchaseRepository.createOrder({
              projectId,
              sourceQuotePurchaseId: purchaseId,
              supplierId: group.supplierId,
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
              sourceQuotePurchaseId: purchaseId,
              supplierId: group.supplierId,
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
        group.items.map((row) => ({
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

      const supplierSegment = sanitizeDocumentSegment(group.supplierName);
      const fileName = `${projectFileSegment}_${purchaseSegment}_${supplierSegment}_${glpiSegment}_${saoPauloNow.isoDate}.pdf`;

      const pdfInput = {
        issuerName: project.organizationName,
        issuerCity: project.city,
        issuerState: project.state,
        projectCode: project.code,
        projectName: project.name,
        supplierName: group.supplierName,
        supplierDocumentNumber: order.supplier?.documentNumber ?? null,
        supplierAddress: order.supplier?.address ?? null,
        supplierContactName: order.supplier?.contactName ?? null,
        supplierPhone: order.supplier?.phone ?? null,
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
        items: group.items.map((row) => ({
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

      generatedOrders.push({
        supplierId: group.supplierId,
        supplierName: group.supplierName,
        itemCount: group.items.length,
        totalValue: Number(group.totalValue.toFixed(2)),
        purchaseOrderId: updatedOrder.id,
        documentId: document.id,
        documentFileName: document.originalFileName,
        folderPathLabel: document.folderPathLabel ?? null,
      });
    }

    const generatedItemCount = generatedOrders.reduce((total, order) => total + order.itemCount, 0);

    return {
      purchaseId,
      purchaseTitle: purchaseState.title,
      generatedOrders,
      skippedItems: Math.max(0, purchaseState.rows.length - generatedItemCount),
    };
  }
}

export const quoteService = new QuoteService();
