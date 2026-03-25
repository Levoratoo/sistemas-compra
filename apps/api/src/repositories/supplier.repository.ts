import { prisma } from '../config/prisma.js';

class SupplierRepository {
  create(data: Parameters<typeof prisma.supplier.create>[0]['data']) {
    return prisma.supplier.create({
      data,
    });
  }

  findMany() {
    return prisma.supplier.findMany({
      orderBy: {
        legalName: 'asc',
      },
    });
  }

  findById(id: string) {
    return prisma.supplier.findUnique({
      where: { id },
    });
  }

  update(id: string, data: Parameters<typeof prisma.supplier.update>[0]['data']) {
    return prisma.supplier.update({
      where: { id },
      data,
    });
  }

  delete(id: string) {
    return prisma.supplier.delete({
      where: { id },
    });
  }
}

export const supplierRepository = new SupplierRepository();
