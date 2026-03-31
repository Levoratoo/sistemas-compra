import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma.js';

const documentInclude = {
  extractedFields: {
    orderBy: {
      createdAt: 'asc',
    },
  },
} satisfies Prisma.ProjectDocumentInclude;

export type ProjectDocumentWithFields = Prisma.ProjectDocumentGetPayload<{
  include: typeof documentInclude;
}>;

class DocumentRepository {
  async createWithExtractedFields(
    data: Prisma.ProjectDocumentUncheckedCreateInput,
    extractedFields: Prisma.ExtractedFieldUncheckedCreateWithoutProjectDocumentInput[] = [],
  ) {
    return prisma.$transaction(async (transaction) => {
      const document = await transaction.projectDocument.create({
        data,
      });

      if (extractedFields.length > 0) {
        await transaction.extractedField.createMany({
          data: extractedFields.map((field) => ({
            ...field,
            projectDocumentId: document.id,
          })),
        });
      }

      return transaction.projectDocument.findUniqueOrThrow({
        where: { id: document.id },
        include: documentInclude,
      });
    });
  }

  findByProject(
    projectId: string,
    folderFilter?: { mode: 'all' } | { mode: 'folder'; folderId: string | null },
    search?: string | null,
  ) {
    const normalizedSearch = search?.trim();
    const folderWhere =
      normalizedSearch && normalizedSearch.length > 0
        ? {}
        : folderFilter?.mode === 'folder'
          ? folderFilter.folderId === null
            ? { folderId: null }
            : { folderId: folderFilter.folderId }
          : {};
    const searchWhere =
      normalizedSearch && normalizedSearch.length > 0
        ? {
            OR: [
              { originalFileName: { contains: normalizedSearch, mode: 'insensitive' as const } },
              { notes: { contains: normalizedSearch, mode: 'insensitive' as const } },
              { searchText: { contains: normalizedSearch, mode: 'insensitive' as const } },
            ],
          }
        : {};

    return prisma.projectDocument.findMany({
      where: { projectId, ...folderWhere, ...searchWhere },
      include: documentInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  updateFolder(documentId: string, projectId: string, folderId: string | null) {
    return prisma.projectDocument.updateMany({
      where: { id: documentId, projectId },
      data: { folderId },
    });
  }

  findById(id: string) {
    return prisma.projectDocument.findUnique({
      where: { id },
      include: documentInclude,
    });
  }

  updateById(id: string, data: Prisma.ProjectDocumentUncheckedUpdateInput) {
    return prisma.projectDocument.update({
      where: { id },
      data,
      include: documentInclude,
    });
  }
}

export const documentRepository = new DocumentRepository();
