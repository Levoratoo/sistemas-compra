import type { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma.js';

class MissingItemReportAttachmentRepository {
  create(data: Prisma.MissingItemReportAttachmentUncheckedCreateInput) {
    return prisma.missingItemReportAttachment.create({ data });
  }

  findById(id: string) {
    return prisma.missingItemReportAttachment.findUnique({
      where: { id },
      include: { report: true },
    });
  }

  delete(id: string) {
    return prisma.missingItemReportAttachment.delete({ where: { id } });
  }
}

export const missingItemReportAttachmentRepository = new MissingItemReportAttachmentRepository();
