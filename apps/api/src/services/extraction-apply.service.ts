import { DataOriginType, DocumentReviewStatus, Prisma, TaskStatus } from '@prisma/client';

import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/app-error.js';
import { parseOptionalDate } from '../utils/date.js';
import { toDecimal } from '../utils/decimal.js';
import type { ApplyExtractionBody } from '../modules/extraction-apply/extraction-apply.schemas.js';
import {
  normalizeOptionalUniqueText,
  toProjectUpdateData,
} from './project.service.js';

/**
 * Evita P2002 ao atualizar Project: há @@unique([organizationName, procurementProcessNumber])
 * e @@unique([organizationName, contractNumber]). Valores iguais a outro projeto quebram o update.
 */
async function assertProjectUpdateDoesNotBreakUniqueness(
  tx: Prisma.TransactionClient,
  projectId: string,
  patch: Prisma.ProjectUpdateInput,
) {
  const current = await tx.project.findUnique({ where: { id: projectId } });
  if (!current) {
    return;
  }

  const nextOrg =
    patch.organizationName !== undefined
      ? String(patch.organizationName).trim()
      : current.organizationName.trim();

  const nextProc =
    patch.procurementProcessNumber !== undefined
      ? normalizeOptionalUniqueText(patch.procurementProcessNumber as string | null)
      : normalizeOptionalUniqueText(current.procurementProcessNumber);

  const nextContract =
    patch.contractNumber !== undefined
      ? normalizeOptionalUniqueText(patch.contractNumber as string | null)
      : normalizeOptionalUniqueText(current.contractNumber);

  if (nextProc) {
    const conflict = await tx.project.findFirst({
      where: {
        id: { not: projectId },
        organizationName: nextOrg,
        procurementProcessNumber: nextProc,
      },
      select: { id: true, code: true },
    });
    if (conflict) {
      throw new AppError(
        `Já existe outro projeto (${conflict.code}) com o mesmo órgão e número de processo licitatório. ` +
          'Altere um dos campos na revisão (por exemplo o processo ou o órgão) ou deixe o processo vazio.',
        409,
      );
    }
  }

  if (nextContract) {
    const conflict = await tx.project.findFirst({
      where: {
        id: { not: projectId },
        organizationName: nextOrg,
        contractNumber: nextContract,
      },
      select: { id: true, code: true },
    });
    if (conflict) {
      throw new AppError(
        `Já existe outro projeto (${conflict.code}) com o mesmo órgão e número de contrato. ` +
          'Ajuste na revisão ou deixe o contrato vazio.',
        409,
      );
    }
  }
}

function stripProjectUniqueCompositeFields(
  data: Prisma.ProjectUpdateInput,
): Prisma.ProjectUpdateInput {
  const copy = { ...data } as Record<string, unknown>;
  delete copy.organizationName;
  delete copy.procurementProcessNumber;
  delete copy.contractNumber;
  delete copy.code;
  return copy as Prisma.ProjectUpdateInput;
}

export async function applyExtractionToProject(
  projectId: string,
  documentId: string,
  body: ApplyExtractionBody,
) {
  const document = await prisma.projectDocument.findFirst({
    where: { id: documentId, projectId },
    select: { id: true },
  });

  if (!document) {
    throw new AppError('Documento não encontrado neste projeto.', 404);
  }

  const projectUpdate = body.project ? toProjectUpdateData(body.project) : undefined;
  const hasProjectUpdate =
    projectUpdate &&
    Object.values(projectUpdate).some((value) => value !== undefined);

  await prisma.$transaction(async (tx) => {
    if (hasProjectUpdate) {
      await assertProjectUpdateDoesNotBreakUniqueness(tx, projectId, projectUpdate);
      try {
        await tx.project.update({
          where: { id: projectId },
          data: projectUpdate,
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const safe = stripProjectUniqueCompositeFields(projectUpdate);
          const hasSafe = safe && Object.values(safe).some((value) => value !== undefined);
          if (hasSafe) {
            await tx.project.update({
              where: { id: projectId },
              data: safe,
            });
          }
        } else {
          throw error;
        }
      }
    }

    await tx.projectRole.deleteMany({
      where: { projectId, sourceDocumentId: documentId },
    });

    await tx.budgetItem.deleteMany({
      where: {
        projectId,
        sourceDocumentId: documentId,
        purchaseOrderItems: { none: {} },
      },
    });

    await tx.implementationTask.deleteMany({
      where: { projectId, sourceDocumentId: documentId },
    });

    if (body.roles.length > 0) {
      await tx.projectRole.createMany({
        data: body.roles.map((role) => ({
          projectId,
          roleName: role.roleName,
          cboCode: role.cboCode ?? null,
          workRegime: role.workRegime ?? null,
          workloadLabel: role.workloadLabel ?? null,
          allocationSector: role.allocationSector ?? null,
          plannedPositions: role.plannedPositions ?? null,
          employeesPerPosition: role.employeesPerPosition ?? null,
          plannedHeadcount: role.plannedHeadcount,
          sourceType: DataOriginType.DOCUMENT_EXTRACTED,
          sourceDocumentId: documentId,
          sourceSheetName: role.sourceSheetName ?? null,
          sourceCellRef: role.sourceCellRef ?? null,
          sourcePage: role.sourcePage ?? null,
          sourceExcerpt: role.sourceExcerpt ?? null,
          notes: role.notes ?? null,
        })),
      });
    }

    if (body.budgetItems.length > 0) {
      await tx.budgetItem.createMany({
        data: body.budgetItems.map((item) => ({
          projectId,
          itemCategory: item.itemCategory,
          subcategory: item.subcategory ?? null,
          name: item.name,
          description: item.description ?? null,
          specification: item.specification ?? null,
          unit: item.unit ?? null,
          sizeLabel: item.sizeLabel ?? null,
          requiresCa: item.requiresCa ?? null,
          roleReference: item.roleReference ?? null,
          allocationSector: item.allocationSector ?? null,
          plannedQuantity: toDecimal(item.plannedQuantity),
          bidUnitValue: toDecimal(item.bidUnitValue),
          rubricMaxValue: toDecimal(item.rubricMaxValue),
          purchasedValue: toDecimal(item.purchasedValue),
          hasBidReference: item.contextOnly
            ? false
            : (item.rubricMaxValue != null && Number(item.rubricMaxValue) > 0) ||
              (item.hasBidReference ?? false),
          contextOnly: item.contextOnly ?? false,
          sourceType: DataOriginType.DOCUMENT_EXTRACTED,
          sourceDocumentId: documentId,
          sourceSheetName: item.sourceSheetName ?? null,
          sourceCellRef: item.sourceCellRef ?? null,
          sourcePage: item.sourcePage ?? null,
          sourceExcerpt: item.sourceExcerpt ?? null,
          notes: item.notes ?? null,
        })),
      });
    }

    if (body.tasks.length > 0) {
      await tx.implementationTask.createMany({
        data: body.tasks.map((task) => ({
          projectId,
          title: task.title,
          category: task.category,
          description: task.description ?? null,
          status: task.status ?? TaskStatus.NOT_STARTED,
          dueDate: parseOptionalDate(task.dueDate ?? undefined),
          sourceDocumentId: documentId,
          sourcePage: task.sourcePage ?? null,
          notes: task.notes ?? null,
        })),
      });
    }

    await tx.projectDocument.update({
      where: { id: documentId },
      data: { reviewStatus: DocumentReviewStatus.REVIEWED },
    });
  });

  return {
    projectId,
    documentId,
    roleCount: body.roles.length,
    budgetItemCount: body.budgetItems.length,
    taskCount: body.tasks.length,
  };
}
