import { prisma } from '../config/prisma.js';

class DocumentFolderRepository {
  listByProject(projectId: string) {
    return prisma.projectDocumentFolder.findMany({
      where: { projectId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  findByIdInProject(id: string, projectId: string) {
    return prisma.projectDocumentFolder.findFirst({
      where: { id, projectId },
    });
  }

  countChildFolders(parentId: string, projectId: string) {
    return prisma.projectDocumentFolder.count({
      where: { parentId, projectId },
    });
  }

  countDocumentsInFolder(folderId: string) {
    return prisma.projectDocument.count({
      where: { folderId },
    });
  }

  create(data: { projectId: string; parentId: string | null; name: string; sortOrder?: number }) {
    return prisma.projectDocumentFolder.create({
      data: {
        projectId: data.projectId,
        parentId: data.parentId,
        name: data.name.trim(),
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  update(id: string, data: { name?: string; parentId?: string | null; sortOrder?: number }) {
    return prisma.projectDocumentFolder.update({
      where: { id },
      data,
    });
  }

  deleteById(id: string) {
    return prisma.projectDocumentFolder.delete({
      where: { id },
    });
  }
}

export const documentFolderRepository = new DocumentFolderRepository();
