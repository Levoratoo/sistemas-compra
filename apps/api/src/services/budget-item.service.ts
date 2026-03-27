import type { BudgetItemAggregate } from '../repositories/budget-item.repository.js';
import { budgetItemRepository } from '../repositories/budget-item.repository.js';
import { documentRepository } from '../repositories/document.repository.js';
import { projectRepository } from '../repositories/project.repository.js';
import { AppError } from '../utils/app-error.js';
import { parseOptionalDate } from '../utils/date.js';
import { decimalToNumber, optionalToDecimal, toDecimal } from '../utils/decimal.js';
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

export function buildBudgetItemResponse(item: BudgetItemAggregate) {
  const bidTotalValue = calculateBidTotalValue(item);
  const realTotalValue = calculateRealTotalValue(item);

  return {
    ...serializeBudgetItem(item),
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
      sourceType: input.sourceType ?? 'MANUAL',
      sourceDocumentId: input.sourceDocumentId ?? null,
      sourceSheetName: input.sourceSheetName ?? null,
      sourceCellRef: input.sourceCellRef ?? null,
      sourcePage: input.sourcePage ?? null,
      sourceExcerpt: input.sourceExcerpt ?? null,
      notes: input.notes ?? null,
      priority: input.priority ?? null,
      peopleCount: input.peopleCount ?? null,
      operationalPurchaseStatus: input.operationalPurchaseStatus ?? null,
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
      sourceType: input.sourceType,
      sourceDocumentId: input.sourceDocumentId,
      sourceSheetName: input.sourceSheetName,
      sourceCellRef: input.sourceCellRef,
      sourcePage: input.sourcePage,
      sourceExcerpt: input.sourceExcerpt,
      notes: input.notes,
      priority: input.priority,
      peopleCount: input.peopleCount,
      operationalPurchaseStatus: input.operationalPurchaseStatus,
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
}

export const budgetItemService = new BudgetItemService();
