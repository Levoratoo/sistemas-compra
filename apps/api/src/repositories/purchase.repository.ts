import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma.js';

const purchaseOrderInclude = {
  supplier: true,
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
