import type { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma.js';

const supplierWithCndAttachments = {
  cndAttachments: {
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.SupplierInclude;

class SupplierRepository {
  create(data: Parameters<typeof prisma.supplier.create>[0]['data']) {
    return prisma.supplier.create({
      data,
      include: supplierWithCndAttachments,
    });
  }

  findMany() {
    return prisma.supplier.findMany({
      orderBy: {
        legalName: 'asc',
      },
      include: supplierWithCndAttachments,
    });
  }

  findById(id: string) {
    return prisma.supplier.findUnique({
      where: { id },
      include: supplierWithCndAttachments,
    });
  }

  update(id: string, data: Parameters<typeof prisma.supplier.update>[0]['data']) {
    return prisma.supplier.update({
      where: { id },
      data,
      include: supplierWithCndAttachments,
    });
  }

  delete(id: string) {
    return prisma.supplier.delete({
      where: { id },
    });
  }
}

export const supplierRepository = new SupplierRepository();
