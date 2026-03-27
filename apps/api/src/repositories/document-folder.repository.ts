import { prisma } from '../config/prisma.js';
import { DEFAULT_FOLDER_COLOR_HEX } from '../constants/folder-appearance.js';

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

  create(data: {
    projectId: string;
    parentId: string | null;
    name: string;
    sortOrder?: number;
    colorHex?: string;
    iconEmoji?: string | null;
  }) {
    return prisma.projectDocumentFolder.create({
      data: {
        projectId: data.projectId,
        parentId: data.parentId,
        name: data.name.trim(),
        sortOrder: data.sortOrder ?? 0,
        colorHex: data.colorHex ?? DEFAULT_FOLDER_COLOR_HEX,
        iconEmoji: data.iconEmoji ?? null,
      },
    });
  }

  update(
    id: string,
    data: {
      name?: string;
      parentId?: string | null;
      sortOrder?: number;
      colorHex?: string;
      iconEmoji?: string | null;
    },
  ) {
    const { name, parentId, sortOrder, colorHex, iconEmoji } = data;
    return prisma.projectDocumentFolder.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(parentId !== undefined && { parentId }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(colorHex !== undefined && { colorHex }),
        ...(iconEmoji !== undefined && { iconEmoji }),
      },
    });
  }

  deleteById(id: string) {
    return prisma.projectDocumentFolder.delete({
      where: { id },
    });
  }
}

export const documentFolderRepository = new DocumentFolderRepository();
