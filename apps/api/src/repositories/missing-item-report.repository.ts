import { OwnerApprovalStatus, type Prisma } from '@prisma/client';

import { prisma } from '../config/prisma.js';

const attachmentsInclude = {
  attachments: {
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.MissingItemReportInclude;

const pendingApprovalInclude = {
  attachments: {
    orderBy: { createdAt: 'asc' as const },
  },
  project: {
    select: { id: true, code: true, name: true },
  },
} as const satisfies Prisma.MissingItemReportInclude;

class MissingItemReportRepository {
  create(data: Prisma.MissingItemReportUncheckedCreateInput) {
    return prisma.missingItemReport.create({
      data,
      include: attachmentsInclude,
    });
  }

  findByProject(projectId: string) {
    return prisma.missingItemReport.findMany({
      where: { projectId },
      orderBy: { requestDate: 'desc' },
      include: attachmentsInclude,
    });
  }

  findPendingApprovalWithProject() {
    return prisma.missingItemReport.findMany({
      where: { ownerApprovalStatus: OwnerApprovalStatus.PENDING },
      orderBy: { requestDate: 'desc' },
      include: pendingApprovalInclude,
    });
  }

  findById(id: string) {
    return prisma.missingItemReport.findUnique({
      where: { id },
      include: attachmentsInclude,
    });
  }

  update(id: string, data: Prisma.MissingItemReportUncheckedUpdateInput) {
    return prisma.missingItemReport.update({
      where: { id },
      data,
      include: attachmentsInclude,
    });
  }

  delete(id: string) {
    return prisma.missingItemReport.delete({ where: { id } });
  }
}

export const missingItemReportRepository = new MissingItemReportRepository();
