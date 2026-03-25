import { prisma } from '../config/prisma.js';

class RoleRepository {
  create(data: Parameters<typeof prisma.projectRole.create>[0]['data']) {
    return prisma.projectRole.create({
      data,
    });
  }

  findByProject(projectId: string) {
    return prisma.projectRole.findMany({
      where: { projectId },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  findById(id: string) {
    return prisma.projectRole.findUnique({
      where: { id },
    });
  }

  update(id: string, data: Parameters<typeof prisma.projectRole.update>[0]['data']) {
    return prisma.projectRole.update({
      where: { id },
      data,
    });
  }

  delete(id: string) {
    return prisma.projectRole.delete({
      where: { id },
    });
  }
}

export const roleRepository = new RoleRepository();
