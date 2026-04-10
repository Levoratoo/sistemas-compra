import type { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma.js';
import type { BudgetItemAggregate } from '../repositories/budget-item.repository.js';
import { budgetItemInclude, budgetItemRepository } from '../repositories/budget-item.repository.js';
import { documentRepository } from '../repositories/document.repository.js';
import { projectRepository } from '../repositories/project.repository.js';
import { AppError } from '../utils/app-error.js';
import { parseOptionalDate } from '../utils/date.js';
import { decimalToNumber, optionalToDecimal, toDecimal } from '../utils/decimal.js';
import { effectiveNextReplenishmentDate, isReplenishmentOverdue } from '../utils/replenishment-dates.js';
import {
  serializeBudgetItem,
  serializeProjectDocument,
  serializePurchaseOrderItem,
  serializeReplenishmentEvent,
  serializeReplenishmentRule,
} from '../utils/serializers.js';
import type {
  CreateBudgetItemInput,
  ManualBudgetItemInput,
  UpdateBudgetItemInput,
} from '../modules/budget-item/budget-item.schemas.js';

async function ensureProjectExists(projectId: string) {
  const project = await projectRepository.exists(projectId);

  if (!project) {
    throw new AppError('Project not found', 404);
  }
}

async function ensureSourceDocumentBelongsToProject(projectId: string, sourceDocumentId?: string | null) {
  if (!sourceDocumentId) {
    return;
  }

  const sourceDocument = await documentRepository.findById(sourceDocumentId);

  if (!sourceDocument) {
    throw new AppError('Source document not found', 404);
  }

  if (sourceDocument.projectId !== projectId) {
    throw new AppError('Source document does not belong to the same project', 409);
  }
}

function dateFromInput(v: string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  return parseOptionalDate(v);
}

function calculateBidTotalValue(item: BudgetItemAggregate) {
  const plannedQuantity = decimalToNumber(item.plannedQuantity);
  const bidUnitValue = decimalToNumber(item.bidUnitValue);

  if (plannedQuantity === null || bidUnitValue === null) {
    return null;
  }

  return plannedQuantity * bidUnitValue;
}

function calculateRealTotalValue(item: BudgetItemAggregate) {
  return item.purchaseOrderItems.reduce((total, purchaseOrderItem) => {
    const quantity = decimalToNumber(purchaseOrderItem.quantityPurchased) ?? 0;
    const realUnitValue = decimalToNumber(purchaseOrderItem.realUnitValue) ?? 0;
    return total + quantity * realUnitValue;
  }, 0);
}

const PURCHASE_STATUS_NORMALIZATION_MAP = new Map<string, string>([
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

function normalizeOperationalPurchaseStatus(value: string | null | undefined) {
  if (value == null) {
    return null;
  }

  const normalizedValue = value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();

  if (!normalizedValue) {
    return null;
  }

  return PURCHASE_STATUS_NORMALIZATION_MAP.get(normalizedValue) ?? value.trim();
}

function budgetItemToNextCycleClone(
  item: BudgetItemAggregate,
  purchaseControlSortRank: number,
): Prisma.BudgetItemUncheckedCreateInput {
  return {
    projectId: item.projectId,
    itemCategory: item.itemCategory,
    subcategory: item.subcategory,
    name: item.name,
    description: item.description,
    specification: item.specification,
    unit: item.unit,
    sizeLabel: item.sizeLabel,
    requiresCa: item.requiresCa,
    roleReference: item.roleReference,
    allocationSector: item.allocationSector,
    plannedQuantity: item.plannedQuantity,
    bidUnitValue: item.bidUnitValue,
    rubricMaxValue: item.rubricMaxValue,
    purchasedValue: item.purchasedValue,
    hasBidReference: item.hasBidReference,
    contextOnly: item.contextOnly,
    supplierQuoteExtraItem: item.supplierQuoteExtraItem,
    sourceType: item.sourceType,
    sourceDocumentId: item.sourceDocumentId,
    sourceSheetName: item.sourceSheetName,
    sourceCellRef: item.sourceCellRef,
    sourcePage: item.sourcePage,
    sourceExcerpt: item.sourceExcerpt,
    notes: item.notes,
    priority: item.priority,
    peopleCount: item.peopleCount,
    operationalPurchaseStatus: normalizeOperationalPurchaseStatus(item.operationalPurchaseStatus),
    editalDeliveryDeadlineDays: item.editalDeliveryDeadlineDays,
    replenishmentPeriodDaysEdital: item.replenishmentPeriodDaysEdital,
    approvedSupplierName: item.approvedSupplierName,
    glpiTicketNumber: item.glpiTicketNumber,
    opPaymentSentAt: null,
    opExpectedDeliveryAt: null,
    opDeliveredAt: null,
    operationalStagesStatus: item.operationalStagesStatus,
    nextReplenishmentExpectedAt: null,
    replenishmentStateLabel: item.replenishmentStateLabel,
    competenceLabel: item.competenceLabel,
    administrativeFeePercent: item.administrativeFeePercent,
    actualUnitValue: item.actualUnitValue,
    purchaseControlSortRank,
    replenishmentCycleConfirmedAt: null,
    replenishmentContinuesAsItemId: null,
  };
}

export function buildBudgetItemResponse(item: BudgetItemAggregate) {
  const bidTotalValue = calculateBidTotalValue(item);
  const realTotalValue = calculateRealTotalValue(item);

  return {
    ...serializeBudgetItem(item),
    operationalPurchaseStatus: normalizeOperationalPurchaseStatus(item.operationalPurchaseStatus),
    bidTotalValue,
    realTotalValue,
    savingsValue: bidTotalValue === null ? null : bidTotalValue - realTotalValue,
    sourceDocument: item.sourceDocument ? serializeProjectDocument(item.sourceDocument) : null,
    purchaseOrderItems: item.purchaseOrderItems.map((purchaseOrderItem) => ({
      ...serializePurchaseOrderItem(purchaseOrderItem),
      purchaseOrder: {
        id: purchaseOrderItem.purchaseOrder.id,
        supplier: purchaseOrderItem.purchaseOrder.supplier,
      },
    })),
    replenishmentRule: item.replenishmentRule
      ? {
          ...serializeReplenishmentRule(item.replenishmentRule),
          events: item.replenishmentRule.events.map(serializeReplenishmentEvent),
        }
      : null,
  };
}

class BudgetItemService {
  async createBudgetItem(projectId: string, input: CreateBudgetItemInput) {
    await ensureProjectExists(projectId);
    await ensureSourceDocumentBelongsToProject(projectId, input.sourceDocumentId);

    const item = await budgetItemRepository.create({
      projectId,
      itemCategory: input.itemCategory,
      subcategory: input.subcategory ?? null,
      name: input.name,
      description: input.description ?? null,
      specification: input.specification ?? null,
      unit: input.unit ?? null,
      sizeLabel: input.sizeLabel ?? null,
      requiresCa: input.requiresCa ?? null,
      roleReference: input.roleReference ?? null,
      allocationSector: input.allocationSector ?? null,
      plannedQuantity: toDecimal(input.plannedQuantity),
      bidUnitValue: toDecimal(input.bidUnitValue),
      rubricMaxValue: toDecimal(input.rubricMaxValue),
      purchasedValue: toDecimal(input.purchasedValue),
      hasBidReference: input.contextOnly ? false : (input.hasBidReference ?? true),
      contextOnly: input.contextOnly ?? false,
      supplierQuoteExtraItem: input.supplierQuoteExtraItem ?? false,
      sourceType: input.sourceType ?? 'MANUAL',
      sourceDocumentId: input.sourceDocumentId ?? null,
      sourceSheetName: input.sourceSheetName ?? null,
      sourceCellRef: input.sourceCellRef ?? null,
      sourcePage: input.sourcePage ?? null,
      sourceExcerpt: input.sourceExcerpt ?? null,
      notes: input.notes ?? null,
      priority: input.priority ?? null,
      peopleCount: input.peopleCount ?? null,
      operationalPurchaseStatus: normalizeOperationalPurchaseStatus(input.operationalPurchaseStatus),
      editalDeliveryDeadlineDays: input.editalDeliveryDeadlineDays ?? null,
      replenishmentPeriodDaysEdital: input.replenishmentPeriodDaysEdital ?? null,
      approvedSupplierName: input.approvedSupplierName ?? null,
      glpiTicketNumber: input.glpiTicketNumber ?? null,
      opPaymentSentAt: dateFromInput(input.opPaymentSentAt as string | null | undefined) ?? null,
      opExpectedDeliveryAt: dateFromInput(input.opExpectedDeliveryAt as string | null | undefined) ?? null,
      opDeliveredAt: dateFromInput(input.opDeliveredAt as string | null | undefined) ?? null,
      operationalStagesStatus: input.operationalStagesStatus ?? null,
      nextReplenishmentExpectedAt:
        dateFromInput(input.nextReplenishmentExpectedAt as string | null | undefined) ?? null,
      replenishmentStateLabel: input.replenishmentStateLabel ?? null,
      competenceLabel: input.competenceLabel ?? null,
      administrativeFeePercent: toDecimal(input.administrativeFeePercent),
      actualUnitValue: toDecimal(input.actualUnitValue),
    });

    return buildBudgetItemResponse(item);
  }

  async listBudgetItems(projectId: string) {
    await ensureProjectExists(projectId);

    const items = await budgetItemRepository.findByProject(projectId);
    return items.map(buildBudgetItemResponse);
  }

  async createManualBudgetItem(projectId: string, input: ManualBudgetItemInput) {
    return this.createBudgetItem(projectId, {
      ...input,
      hasBidReference: input.hasBidReference ?? false,
      sourceType: 'MANUAL',
    });
  }

  async updateBudgetItem(itemId: string, input: UpdateBudgetItemInput) {
    const existingItem = await budgetItemRepository.findById(itemId);

    if (!existingItem) {
      throw new AppError('Budget item not found', 404);
    }

    await ensureSourceDocumentBelongsToProject(existingItem.projectId, input.sourceDocumentId);

    const item = await budgetItemRepository.update(itemId, {
      itemCategory: input.itemCategory,
      subcategory: input.subcategory,
      name: input.name,
      description: input.description,
      specification: input.specification,
      unit: input.unit,
      sizeLabel: input.sizeLabel,
      requiresCa: input.requiresCa,
      roleReference: input.roleReference,
      allocationSector: input.allocationSector,
      plannedQuantity: optionalToDecimal(input.plannedQuantity),
      bidUnitValue: optionalToDecimal(input.bidUnitValue),
      rubricMaxValue: optionalToDecimal(input.rubricMaxValue),
      purchasedValue: optionalToDecimal(input.purchasedValue),
      hasBidReference: input.hasBidReference,
      contextOnly: input.contextOnly,
      supplierQuoteExtraItem: input.supplierQuoteExtraItem,
      sourceType: input.sourceType,
      sourceDocumentId: input.sourceDocumentId,
      sourceSheetName: input.sourceSheetName,
      sourceCellRef: input.sourceCellRef,
      sourcePage: input.sourcePage,
      sourceExcerpt: input.sourceExcerpt,
      notes: input.notes,
      priority: input.priority,
      peopleCount: input.peopleCount,
      operationalPurchaseStatus:
        input.operationalPurchaseStatus !== undefined
          ? normalizeOperationalPurchaseStatus(input.operationalPurchaseStatus)
          : undefined,
      editalDeliveryDeadlineDays: input.editalDeliveryDeadlineDays,
      replenishmentPeriodDaysEdital: input.replenishmentPeriodDaysEdital,
      approvedSupplierName: input.approvedSupplierName,
      glpiTicketNumber: input.glpiTicketNumber,
      opPaymentSentAt:
        input.opPaymentSentAt !== undefined
          ? dateFromInput(input.opPaymentSentAt as string | null | undefined)
          : undefined,
      opExpectedDeliveryAt:
        input.opExpectedDeliveryAt !== undefined
          ? dateFromInput(input.opExpectedDeliveryAt as string | null | undefined)
          : undefined,
      opDeliveredAt:
        input.opDeliveredAt !== undefined
          ? dateFromInput(input.opDeliveredAt as string | null | undefined)
          : undefined,
      operationalStagesStatus: input.operationalStagesStatus,
      nextReplenishmentExpectedAt:
        input.nextReplenishmentExpectedAt !== undefined
          ? dateFromInput(input.nextReplenishmentExpectedAt as string | null | undefined)
          : undefined,
      replenishmentStateLabel: input.replenishmentStateLabel,
      competenceLabel: input.competenceLabel,
      administrativeFeePercent: optionalToDecimal(input.administrativeFeePercent),
      actualUnitValue: optionalToDecimal(input.actualUnitValue),
    });

    return buildBudgetItemResponse(item);
  }

  async deleteBudgetItem(itemId: string) {
    const existingItem = await budgetItemRepository.findById(itemId);

    if (!existingItem) {
      throw new AppError('Budget item not found', 404);
    }

    await budgetItemRepository.delete(itemId);
  }

  /**
   * Confirma que o item em atraso foi reposto: linha atual fica “fechada” (verde, em baixo) e cria-se o ciclo seguinte no topo.
   */
  async confirmReplenishmentCycle(itemId: string) {
    const existing = await budgetItemRepository.findById(itemId);

    if (!existing) {
      throw new AppError('Item não encontrado.', 404);
    }

    if (existing.contextOnly) {
      throw new AppError('Itens só de contexto não suportam ciclo de reposição.', 400);
    }

    if (existing.replenishmentCycleConfirmedAt) {
      throw new AppError('Este ciclo já foi confirmado. Desfaça antes de confirmar de novo.', 409);
    }

    const effective = effectiveNextReplenishmentDate(existing);
    if (!effective) {
      throw new AppError('Defina a data de entrega na unidade ou a data prevista de reposição.', 400);
    }

    if (!isReplenishmentOverdue(effective)) {
      throw new AppError('A reposição ainda não está em atraso (só é possível confirmar após a data prevista).', 400);
    }

    const projectId = existing.projectId;

    const result = await prisma.$transaction(async (tx) => {
      const bounds = await tx.budgetItem.aggregate({
        where: { projectId },
        _min: { purchaseControlSortRank: true },
        _max: { purchaseControlSortRank: true },
      });

      const minR = bounds._min.purchaseControlSortRank ?? 0;
      const maxR = bounds._max.purchaseControlSortRank ?? 0;

      const cloneData = budgetItemToNextCycleClone(existing, minR - 1);
      const fullClone = await tx.budgetItem.create({
        data: cloneData,
        include: budgetItemInclude,
      });

      const updatedClosed = await tx.budgetItem.update({
        where: { id: itemId },
        data: {
          replenishmentCycleConfirmedAt: new Date(),
          replenishmentContinuesAsItemId: fullClone.id,
          purchaseControlSortRank: maxR + 100,
        },
        include: budgetItemInclude,
      });

      return { updatedClosed, fullClone };
    });

    return {
      closedItem: buildBudgetItemResponse(result.updatedClosed),
      newCycleItem: buildBudgetItemResponse(result.fullClone),
    };
  }

  /**
   * Desfaz a confirmação: remove a linha do ciclo novo e repõe a linha original no topo da ordenação.
   */
  async unconfirmReplenishmentCycle(itemId: string) {
    const existing = await budgetItemRepository.findById(itemId);

    if (!existing) {
      throw new AppError('Item não encontrado.', 404);
    }

    if (!existing.replenishmentCycleConfirmedAt || !existing.replenishmentContinuesAsItemId) {
      throw new AppError('Este item não tem confirmação de reposição para desfazer.', 409);
    }

    const cloneId = existing.replenishmentContinuesAsItemId;
    const projectId = existing.projectId;

    await prisma.$transaction(async (tx) => {
      const bounds = await tx.budgetItem.aggregate({
        where: { projectId },
        _min: { purchaseControlSortRank: true },
      });
      const minR = bounds._min.purchaseControlSortRank ?? 0;

      await tx.budgetItem.update({
        where: { id: itemId },
        data: {
          replenishmentContinuesAsItemId: null,
          replenishmentCycleConfirmedAt: null,
          purchaseControlSortRank: minR - 1,
        },
      });

      await tx.budgetItem.delete({ where: { id: cloneId } });
    });

    const reopened = await budgetItemRepository.findById(itemId);
    if (!reopened) {
      throw new AppError('Item não encontrado.', 404);
    }

    return buildBudgetItemResponse(reopened);
  }
}

export const budgetItemService = new BudgetItemService();
