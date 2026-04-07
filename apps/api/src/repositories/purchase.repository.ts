import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma.js';

const purchaseOrderInclude = {
  supplier: true,
  generatedDocument: true,
  items: {
    include: {
      budgetItem: true,
      replenishmentEvents: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  },
} satisfies Prisma.PurchaseOrderInclude;

const purchaseOrderItemInclude = {
  budgetItem: true,
  purchaseOrder: {
    include: {
      supplier: true,
      generatedDocument: true,
      project: true,
    },
  },
  replenishmentEvents: true,
} satisfies Prisma.PurchaseOrderItemInclude;

export type PurchaseOrderAggregate = Prisma.PurchaseOrderGetPayload<{
  include: typeof purchaseOrderInclude;
}>;

export type PurchaseOrderItemAggregate = Prisma.PurchaseOrderItemGetPayload<{
  include: typeof purchaseOrderItemInclude;
}>;

class PurchaseRepository {
  createOrder(data: Prisma.PurchaseOrderUncheckedCreateInput) {
    return prisma.purchaseOrder.create({
      data,
      include: purchaseOrderInclude,
    });
  }

  updateOrder(id: string, data: Prisma.PurchaseOrderUncheckedUpdateInput) {
    return prisma.purchaseOrder.update({
      where: { id },
      data,
      include: purchaseOrderInclude,
    });
  }

  findOrdersByProject(projectId: string) {
    return prisma.purchaseOrder.findMany({
      where: { projectId },
      include: purchaseOrderInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  findOrderById(id: string) {
    return prisma.purchaseOrder.findUnique({
      where: { id },
      include: purchaseOrderInclude,
    });
  }

  findOrderByProjectAndGlpi(projectId: string, glpiNumber: string) {
    return prisma.purchaseOrder.findFirst({
      where: {
        projectId,
        glpiNumber,
      },
      include: purchaseOrderInclude,
    });
  }

  findOrderBySourceQuotePurchaseAndSupplier(
    sourceQuotePurchaseId: string,
    supplierId: string,
    glpiNumber: string,
  ) {
    return prisma.purchaseOrder.findFirst({
      where: {
        sourceQuotePurchaseId,
        supplierId,
        glpiNumber,
      },
      include: purchaseOrderInclude,
    });
  }

  replaceOrderItems(
    purchaseOrderId: string,
    items: Prisma.PurchaseOrderItemUncheckedCreateInput[],
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.purchaseOrderItem.deleteMany({
        where: { purchaseOrderId },
      });

      if (items.length > 0) {
        await tx.purchaseOrderItem.createMany({
          data: items,
        });
      }

      return tx.purchaseOrder.findUniqueOrThrow({
        where: { id: purchaseOrderId },
        include: purchaseOrderInclude,
      });
    });
  }

  createOrderItem(data: Prisma.PurchaseOrderItemUncheckedCreateInput) {
    return prisma.purchaseOrderItem.create({
      data,
      include: purchaseOrderItemInclude,
    });
  }

  findLastDeliveredItemByBudgetItem(budgetItemId: string) {
    return prisma.purchaseOrderItem.findFirst({
      where: {
        budgetItemId,
        deliveredAt: {
          not: null,
        },
      },
      orderBy: {
        deliveredAt: 'desc',
      },
      include: purchaseOrderItemInclude,
    });
  }
}

export const purchaseRepository = new PurchaseRepository();
