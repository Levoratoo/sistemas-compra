import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma.js';

const budgetItemInclude = {
  sourceDocument: true,
  purchaseOrderItems: {
    include: {
      purchaseOrder: {
        include: {
          supplier: true,
        },
      },
      replenishmentEvents: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  },
  replenishmentRule: {
    include: {
      events: {
        include: {
          purchaseOrderItem: true,
        },
        orderBy: {
          plannedDate: 'asc',
        },
      },
    },
  },
} satisfies Prisma.BudgetItemInclude;

export type BudgetItemAggregate = Prisma.BudgetItemGetPayload<{
  include: typeof budgetItemInclude;
}>;

class BudgetItemRepository {
  create(data: Prisma.BudgetItemUncheckedCreateInput) {
    return prisma.budgetItem.create({
      data,
      include: budgetItemInclude,
    });
  }

  findByProject(projectId: string) {
    return prisma.budgetItem.findMany({
      where: { projectId },
      include: budgetItemInclude,
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  findById(id: string) {
    return prisma.budgetItem.findUnique({
      where: { id },
      include: budgetItemInclude,
    });
  }

  update(id: string, data: Prisma.BudgetItemUncheckedUpdateInput) {
    return prisma.budgetItem.update({
      where: { id },
      data,
      include: budgetItemInclude,
    });
  }

  delete(id: string) {
    return prisma.budgetItem.delete({
      where: { id },
    });
  }
}

export const budgetItemRepository = new BudgetItemRepository();
