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

  findByProject(projectId: string) {
    return prisma.projectDocument.findMany({
      where: { projectId },
      include: documentInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  findById(id: string) {
    return prisma.projectDocument.findUnique({
      where: { id },
      include: documentInclude,
    });
  }
}

export const documentRepository = new DocumentRepository();
