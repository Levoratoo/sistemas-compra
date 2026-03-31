import { Prisma } from '@prisma/client';

import { budgetItemRepository } from '../repositories/budget-item.repository.js';
import { projectRepository } from '../repositories/project.repository.js';
import { purchaseRepository } from '../repositories/purchase.repository.js';
import { supplierRepository } from '../repositories/supplier.repository.js';
import { AppError } from '../utils/app-error.js';
import { decimalToNumber, toDecimal } from '../utils/decimal.js';
import { parseOptionalDate } from '../utils/date.js';
import {
  serializeBudgetItem,
  serializePurchaseOrder,
  serializePurchaseOrderItem,
  serializeSupplier,
} from '../utils/serializers.js';
import type {
  CreatePurchaseOrderInput,
  CreatePurchaseOrderItemInput,
} from '../modules/purchase/purchase.schemas.js';
import { budgetItemService } from './budget-item.service.js';
import { replenishmentService } from './replenishment.service.js';

function buildPurchaseOrderItemResponse(
  item: Awaited<ReturnType<typeof purchaseRepository.createOrderItem>>,
) {
  const quantityPurchased = decimalToNumber(item.quantityPurchased) ?? 0;
  const realUnitValue = decimalToNumber(item.realUnitValue) ?? 0;
  const budgetUnitValue = decimalToNumber(item.budgetItem.bidUnitValue);
  const realTotalValue = quantityPurchased * realUnitValue;
  const budgetTotalValue = budgetUnitValue === null ? null : quantityPurchased * budgetUnitValue;

  return {
    ...serializePurchaseOrderItem(item),
    realTotalValue,
    budgetTotalValue,
    savingsValue: budgetTotalValue === null ? null : budgetTotalValue - realTotalValue,
    isAboveBudget: budgetUnitValue === null ? false : realUnitValue > budgetUnitValue,
    budgetItem: serializeBudgetItem(item.budgetItem),
    purchaseOrder: {
      ...serializePurchaseOrder(item.purchaseOrder),
      supplier: item.purchaseOrder.supplier ? serializeSupplier(item.purchaseOrder.supplier) : null,
      generatedDocument: item.purchaseOrder.generatedDocument
        ? {
            id: item.purchaseOrder.generatedDocument.id,
            originalFileName: item.purchaseOrder.generatedDocument.originalFileName,
          }
        : null,
      project: {
        id: item.purchaseOrder.project.id,
        code: item.purchaseOrder.project.code,
        name: item.purchaseOrder.project.name,
      },
    },
  };
}

function buildPurchaseOrderResponse(
  order: Awaited<ReturnType<typeof purchaseRepository.findOrderById>> extends infer T ? NonNullable<T> : never,
) {
  const items = order.items.map((item) => {
    const quantityPurchased = decimalToNumber(item.quantityPurchased) ?? 0;
    const realUnitValue = decimalToNumber(item.realUnitValue) ?? 0;
    const budgetUnitValue = decimalToNumber(item.budgetItem.bidUnitValue);
    const realTotalValue = quantityPurchased * realUnitValue;
    const budgetTotalValue = budgetUnitValue === null ? null : quantityPurchased * budgetUnitValue;

    return {
      ...serializePurchaseOrderItem(item),
      realTotalValue,
      budgetTotalValue,
      savingsValue: budgetTotalValue === null ? null : budgetTotalValue - realTotalValue,
      isAboveBudget: budgetUnitValue === null ? false : realUnitValue > budgetUnitValue,
      budgetItem: serializeBudgetItem(item.budgetItem),
    };
  });

  return {
    ...serializePurchaseOrder(order),
    supplier: order.supplier ? serializeSupplier(order.supplier) : null,
    generatedDocument: order.generatedDocument
      ? {
          id: order.generatedDocument.id,
          originalFileName: order.generatedDocument.originalFileName,
        }
      : null,
    items,
    totalRealValue: items.reduce((total, item) => total + item.realTotalValue, 0),
    totalBudgetValue: items.reduce((total, item) => total + (item.budgetTotalValue ?? 0), 0),
  };
}

async function ensureProjectExists(projectId: string) {
  const project = await projectRepository.exists(projectId);

  if (!project) {
    throw new AppError('Project not found', 404);
  }
}

class PurchaseService {
  async createPurchaseOrder(projectId: string, input: CreatePurchaseOrderInput) {
    await ensureProjectExists(projectId);

    if (input.supplierId) {
      const supplier = await supplierRepository.findById(input.supplierId);

      if (!supplier) {
        throw new AppError('Supplier not found', 404);
      }
    }

    const order = await purchaseRepository.createOrder({
      projectId,
      supplierId: input.supplierId ?? null,
      purchaseStatus: input.purchaseStatus ?? 'TO_START',
      purchaseDate: parseOptionalDate(input.purchaseDate),
      internalReference: input.internalReference ?? null,
      glpiNumber: input.glpiNumber ?? null,
      paymentSentAt: parseOptionalDate(input.paymentSentAt),
      notes: input.notes ?? null,
    });

    return buildPurchaseOrderResponse(order);
  }

  async listProjectPurchaseOrders(projectId: string) {
    await ensureProjectExists(projectId);
    const orders = await purchaseRepository.findOrdersByProject(projectId);
    return orders.map(buildPurchaseOrderResponse);
  }

  async createPurchaseOrderItem(purchaseOrderId: string, input: CreatePurchaseOrderItemInput) {
    const purchaseOrder = await purchaseRepository.findOrderById(purchaseOrderId);

    if (!purchaseOrder) {
      throw new AppError('Purchase order not found', 404);
    }

    let budgetItemId = input.budgetItemId ?? null;

    if (budgetItemId) {
      const existingBudgetItem = await budgetItemRepository.findById(budgetItemId);

      if (!existingBudgetItem) {
        if (!input.manualBudgetItem) {
          throw new AppError('Budget item not found', 404);
        }

        const manualBudgetItem = await budgetItemService.createManualBudgetItem(
          purchaseOrder.projectId,
          input.manualBudgetItem,
        );

        budgetItemId = manualBudgetItem.id;
      } else if (existingBudgetItem.projectId !== purchaseOrder.projectId) {
        throw new AppError('Budget item does not belong to the same project', 409);
      }
    } else if (input.manualBudgetItem) {
      const manualBudgetItem = await budgetItemService.createManualBudgetItem(
        purchaseOrder.projectId,
        input.manualBudgetItem,
      );

      budgetItemId = manualBudgetItem.id;
    }

    if (!budgetItemId) {
      throw new AppError('Purchase order item must reference a budget item', 422);
    }

    const item = await purchaseRepository.createOrderItem({
      purchaseOrderId,
      budgetItemId,
      quantityPurchased: toDecimal(input.quantityPurchased) ?? new Prisma.Decimal(0),
      realUnitValue: toDecimal(input.realUnitValue) ?? new Prisma.Decimal(0),
      expectedDeliveryDate: parseOptionalDate(input.expectedDeliveryDate),
      deliveredAt: parseOptionalDate(input.deliveredAt),
      deliveryStatus: input.deliveryStatus ?? 'NOT_SCHEDULED',
      notes: input.notes ?? null,
    });

    await replenishmentService.syncRuleByBudgetItemId(budgetItemId);

    return buildPurchaseOrderItemResponse(item);
  }
}

export const purchaseService = new PurchaseService();
