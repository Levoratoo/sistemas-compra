import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma.js';

export const projectDetailInclude = {
  documents: {
    include: {
      extractedFields: {
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  },
  roles: {
    orderBy: {
      createdAt: 'asc',
    },
  },
  budgetItems: {
    include: {
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
    },
    orderBy: {
      createdAt: 'asc',
    },
  },
  purchaseOrders: {
    include: {
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
    },
    orderBy: {
      createdAt: 'desc',
    },
  },
  implementationTasks: {
    orderBy: {
      createdAt: 'asc',
    },
  },
} satisfies Prisma.ProjectInclude;

export type ProjectAggregate = Prisma.ProjectGetPayload<{
  include: typeof projectDetailInclude;
}>;

class ProjectRepository {
  create(data: Prisma.ProjectCreateInput) {
    return prisma.project.create({
      data,
      include: projectDetailInclude,
    });
  }

  findMany(where?: Prisma.ProjectWhereInput) {
    return prisma.project.findMany({
      where,
      include: projectDetailInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  findById(id: string) {
    return prisma.project.findUnique({
      where: { id },
      include: projectDetailInclude,
    });
  }

  update(id: string, data: Prisma.ProjectUpdateInput) {
    return prisma.project.update({
      where: { id },
      data,
      include: projectDetailInclude,
    });
  }

  delete(id: string) {
    return prisma.project.delete({
      where: { id },
    });
  }

  exists(id: string) {
    return prisma.project.findUnique({
      where: { id },
      select: { id: true },
    });
  }

  /** Dados mínimos para e-mails/notificações sem carregar o agregado completo. */
  findSummaryById(id: string) {
    return prisma.project.findUnique({
      where: { id },
      select: { id: true, name: true, code: true },
    });
  }
}

export const projectRepository = new ProjectRepository();
