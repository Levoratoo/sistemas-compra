import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma.js';

const replenishmentRuleInclude = {
  budgetItem: {
    include: {
      project: true,
      purchaseOrderItems: {
        include: {
          purchaseOrder: true,
        },
        orderBy: {
          deliveredAt: 'desc',
        },
      },
    },
  },
  events: {
    include: {
      purchaseOrderItem: true,
    },
    orderBy: {
      plannedDate: 'asc',
    },
  },
} satisfies Prisma.ReplenishmentRuleInclude;

export type ReplenishmentRuleAggregate = Prisma.ReplenishmentRuleGetPayload<{
  include: typeof replenishmentRuleInclude;
}>;

class ReplenishmentRepository {
  upsertRuleByBudgetItem(
    budgetItemId: string,
    createData: Prisma.ReplenishmentRuleUncheckedCreateInput,
    updateData: Prisma.ReplenishmentRuleUncheckedUpdateInput,
  ) {
    return prisma.replenishmentRule.upsert({
      where: { budgetItemId },
      create: createData,
      update: updateData,
      include: replenishmentRuleInclude,
    });
  }

  findByBudgetItemId(budgetItemId: string) {
    return prisma.replenishmentRule.findUnique({
      where: { budgetItemId },
      include: replenishmentRuleInclude,
    });
  }

  createEvent(data: Prisma.ReplenishmentEventUncheckedCreateInput) {
    return prisma.replenishmentEvent.create({
      data,
      include: {
        purchaseOrderItem: true,
        replenishmentRule: {
          include: {
            budgetItem: true,
          },
        },
      },
    });
  }

  deletePendingEventsByRule(replenishmentRuleId: string) {
    return prisma.replenishmentEvent.deleteMany({
      where: {
        replenishmentRuleId,
        completedDate: null,
      },
    });
  }

  findLatestCompletedEvent(replenishmentRuleId: string) {
    return prisma.replenishmentEvent.findFirst({
      where: {
        replenishmentRuleId,
        completedDate: {
          not: null,
        },
      },
      orderBy: {
        completedDate: 'desc',
      },
    });
  }

  listByProject(projectId: string) {
    return prisma.replenishmentRule.findMany({
      where: {
        budgetItem: {
          projectId,
        },
      },
      include: replenishmentRuleInclude,
      orderBy: {
        createdAt: 'asc',
      },
    });
  }
}

export const replenishmentRepository = new ReplenishmentRepository();
